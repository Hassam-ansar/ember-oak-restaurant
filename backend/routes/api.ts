import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer } from 'socket.io';
import { db } from '../db/datastore.js';
import {
  AuthenticatedRequest,
  optionalAuth,
  requireAuth,
  requireRole,
  signAuthToken,
} from '../middleware/auth.js';
import {
  IOrder,
  IOrderItem,
  IProduct,
  OrderStatus,
  PaymentStatus,
} from '../models/schemas.js';

export function createApiRouter(io: SocketIOServer): Router {
  const router = Router();

  // Helper: Server-side price & recipe COGS calculation
  function computeOrderTotals(params: {
    items: {
      productId: string;
      quantity: number;
      selectedSizeName?: string;
      selectedCrustName?: string;
      selectedToppingNames?: string[];
      selectedAddOnNames?: string[];
      specialInstructions?: string;
    }[];
    orderType: string;
    deliveryZoneName?: string;
    couponCode?: string;
    customDiscountAmount?: number;
  }) {
    const detailedItems: IOrderItem[] = [];
    let subtotal = 0;
    let estimatedCost = 0;

    for (const rawItem of params.items) {
      const product = db.state.products.find((p) => p.id === rawItem.productId);
      if (!product) continue;

      const qty = Math.max(1, Number(rawItem.quantity) || 1);
      const sizeOpt = product.sizes.find((s) => s.name === rawItem.selectedSizeName) || product.sizes[0];
      const crustOpt = product.crusts.find((c) => c.name === rawItem.selectedCrustName) || product.crusts[0];

      const chosenToppings = (rawItem.selectedToppingNames || [])
        .map((tName) => product.toppings.find((t) => t.name === tName))
        .filter((t): t is { name: string; price: number } => Boolean(t));

      const chosenAddOns = (rawItem.selectedAddOnNames || [])
        .map((aName) => product.addOns.find((a) => a.name === aName))
        .filter((a): a is { name: string; price: number } => Boolean(a));

      const sizePrice = sizeOpt ? sizeOpt.price : 0;
      const crustPrice = crustOpt ? crustOpt.price : 0;
      const toppingsPrice = chosenToppings.reduce((acc, t) => acc + t.price, 0);
      const addOnsPrice = chosenAddOns.reduce((acc, a) => acc + a.price, 0);

      const itemUnitTotal = Number(
        (product.basePrice + sizePrice + crustPrice + toppingsPrice + addOnsPrice).toFixed(2)
      );
      const lineTotal = Number((itemUnitTotal * qty).toFixed(2));
      subtotal += lineTotal;

      // Calculate recipe COGS from inventory unit costs
      let unitRecipeCost = 0;
      for (const rec of product.recipe || []) {
        const inv = db.state.inventory.find((i) => i.id === rec.inventoryItemId);
        if (inv) {
          unitRecipeCost += inv.costPerUnit * rec.quantityPerUnit;
        }
      }
      if (unitRecipeCost === 0) {
        unitRecipeCost = product.basePrice * 0.28;
      }
      estimatedCost += unitRecipeCost * qty;

      detailedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitBasePrice: product.basePrice,
        selectedSize: sizeOpt ? { name: sizeOpt.name, price: sizeOpt.price } : undefined,
        selectedCrust: crustOpt ? { name: crustOpt.name, price: crustOpt.price } : undefined,
        selectedToppings: chosenToppings,
        selectedAddOns: chosenAddOns,
        specialInstructions: rawItem.specialInstructions?.trim() || undefined,
        itemUnitTotal,
        lineTotal,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    estimatedCost = Number(estimatedCost.toFixed(2));

    // Delivery Zone & Fee
    let deliveryFee = 0;
    let estimatedDeliveryMinutes = 20;
    let minOrderRequired = 0;

    if (params.orderType === 'delivery') {
      const zone =
        db.state.settings.deliveryZones.find((z) => z.name === params.deliveryZoneName) ||
        db.state.settings.deliveryZones[0];
      if (zone) {
        minOrderRequired = zone.minOrder;
        estimatedDeliveryMinutes = zone.estimatedMinutes;
        // Free delivery on orders >= $50
        deliveryFee = subtotal >= 50 ? 0 : zone.fee;
      }
    }

    // Coupon or POS Discount
    let discountAmount = 0;
    let appliedCouponCode: string | undefined;

    if (params.couponCode) {
      const codeUpper = params.couponCode.trim().toUpperCase();
      const coupon = db.state.coupons.find(
        (c) => c.code === codeUpper && c.isActive && new Date(c.expiresAt) >= new Date()
      );
      if (coupon && subtotal >= coupon.minOrderAmount && coupon.usageCount < coupon.usageLimit) {
        if (coupon.discountType === 'percentage') {
          discountAmount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = coupon.maxDiscountAmount;
          }
        } else {
          discountAmount = coupon.discountValue;
        }
        discountAmount = Math.min(subtotal, Number(discountAmount.toFixed(2)));
        appliedCouponCode = coupon.code;
      }
    } else if (params.customDiscountAmount && params.customDiscountAmount > 0) {
      discountAmount = Math.min(subtotal, Number(params.customDiscountAmount.toFixed(2)));
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number(((taxableAmount * db.state.settings.taxRatePercent) / 100).toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount + deliveryFee).toFixed(2));

    return {
      detailedItems,
      subtotal,
      discountAmount,
      appliedCouponCode,
      taxAmount,
      deliveryFee,
      totalAmount,
      estimatedCost,
      estimatedDeliveryMinutes,
      minOrderRequired,
    };
  }

  // Helper: Deduct recipe stock when order enters Preparing / Ready / Delivered
  function deductOrderInventory(order: IOrder, actorName: string): void {
    if (order.inventoryDeducted) return;
    for (const item of order.items) {
      const product = db.state.products.find((p) => p.id === item.productId);
      if (!product || !product.recipe) continue;
      for (const rec of product.recipe) {
        const inv = db.state.inventory.find((i) => i.id === rec.inventoryItemId);
        if (inv) {
          const totalUsed = Number((rec.quantityPerUnit * item.quantity).toFixed(3));
          inv.currentStock = Math.max(0, Number((inv.currentStock - totalUsed).toFixed(2)));
        }
      }
    }
    order.inventoryDeducted = true;
    db.logAudit(
      'INVENTORY_DEDUCTED',
      actorName,
      'kitchen',
      `Automatically deducted recipe stock for Order #${order.orderNumber}.`
    );
    io.emit('inventory:updated', db.state.inventory);
  }

  // ============================================================================
  // 1. BOOTSTRAP & PUBLIC SETTINGS
  // ============================================================================
  router.get('/bootstrap', (_req, res) => {
    res.json({
      dataMode: db.state.dataMode,
      mongoConnected: db.state.mongoConnected,
      settings: db.state.settings,
      categories: db.state.categories.sort((a, b) => a.sortOrder - b.sortOrder),
      products: db.state.products,
      coupons: db.state.coupons.filter((c) => c.isActive),
      reviews: db.state.reviews.slice(0, 30),
      riders: db.state.users
        .filter((u) => u.role === 'rider' && u.isActive)
        .map((u) => ({ id: u.id, name: u.name, phone: u.phone })),
    });
  });

  // ============================================================================
  // 2. AUTHENTICATION & USER ACCOUNTS
  // ============================================================================
  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = db.state.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
    if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    db.logAudit('USER_LOGIN', user.name, user.role, `Signed in via email (${user.email})`);
    const { passwordHash: _ph, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  router.post('/auth/register', (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      res.status(400).json({ error: 'Name, email, phone, and password are required.' });
      return;
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    if (db.state.users.some((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      passwordHash: bcrypt.hashSync(String(password), 10),
      role: 'customer' as const,
      loyaltyPoints: 100, // Welcome bonus
      favorites: [],
      savedAddresses: [],
      isActive: true,
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.state.users.push(newUser);
    db.saveToDisk();
    db.logAudit('CUSTOMER_REGISTERED', newUser.name, 'customer', `New customer registered (${newUser.email})`);

    const token = signAuthToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
    const { passwordHash: _ph, ...safeUser } = newUser;
    res.status(201).json({ token, user: safeUser });
  });

  // Instant Role Switcher for seamless evaluation of all 6 roles
  router.post('/auth/quick-switch', (req, res) => {
    const { role } = req.body;
    const user = db.state.users.find((u) => u.role === role);
    if (!user) {
      res.status(404).json({ error: `No account found for role ${role}` });
      return;
    }
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    const { passwordHash: _ph, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = db.state.users.find((u) => u.id === req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { passwordHash: _ph, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  router.put('/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = db.state.users.find((u) => u.id === req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { name, phone, savedAddresses, toggleFavoriteProductId } = req.body;
    if (name) user.name = String(name).trim();
    if (phone) user.phone = String(phone).trim();
    if (Array.isArray(savedAddresses)) {
      user.savedAddresses = savedAddresses;
    }
    if (toggleFavoriteProductId) {
      const idx = user.favorites.indexOf(toggleFavoriteProductId);
      if (idx >= 0) {
        user.favorites.splice(idx, 1);
      } else {
        user.favorites.push(toggleFavoriteProductId);
      }
    }
    user.updatedAt = new Date().toISOString();
    db.saveToDisk();
    const { passwordHash: _ph, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ============================================================================
  // 3. FOOD MENU: CATEGORIES, PRODUCTS & REVIEWS
  // ============================================================================
  router.post(
    '/categories',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const { name, description, sortOrder } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Category name is required.' });
        return;
      }
      const slug = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const newCat = {
        id: `cat-${Date.now()}`,
        name: String(name).trim(),
        slug: `${slug}-${Date.now().toString().slice(-3)}`,
        description: String(description || '').trim(),
        sortOrder: Number(sortOrder) || db.state.categories.length + 1,
        isActive: true,
        isDemo: false,
      };
      db.state.categories.push(newCat);
      db.logAudit('CATEGORY_CREATED', req.user!.name, req.user!.role, `Created category '${newCat.name}'`);
      io.emit('menu:updated');
      res.status(201).json(newCat);
    }
  );

  router.delete(
    '/categories/:id',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const idx = db.state.categories.findIndex((c) => c.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Category not found.' });
        return;
      }
      const removed = db.state.categories.splice(idx, 1)[0];
      db.logAudit('CATEGORY_DELETED', req.user!.name, req.user!.role, `Deleted category '${removed.name}'`);
      io.emit('menu:updated');
      res.json({ success: true });
    }
  );

  router.post(
    '/products',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body;
      if (!body.name || !body.categoryId || body.basePrice === undefined) {
        res.status(400).json({ error: 'Product name, category, and base price are required.' });
        return;
      }
      const category = db.state.categories.find((c) => c.id === body.categoryId);
      const newProduct: IProduct = {
        id: `prod-${Date.now()}`,
        name: String(body.name).trim(),
        categoryId: body.categoryId,
        categoryName: category ? category.name : body.categoryName || 'Menu Item',
        description: String(body.description || 'Freshly prepared with signature ingredients.').trim(),
        image: String(body.image || '/src/assets/images/food_pizza_crown_crust_1791612750318.jpg').trim(),
        basePrice: Number(body.basePrice),
        sizes: Array.isArray(body.sizes) ? body.sizes : [{ name: 'Regular', price: 0 }],
        crusts: Array.isArray(body.crusts) ? body.crusts : [],
        toppings: Array.isArray(body.toppings) ? body.toppings : [],
        addOns: Array.isArray(body.addOns) ? body.addOns : [],
        ingredientsList: Array.isArray(body.ingredientsList) ? body.ingredientsList : [],
        recipe: Array.isArray(body.recipe) ? body.recipe : [],
        prepTimeMinutes: Number(body.prepTimeMinutes) || 15,
        isAvailable: body.isAvailable !== false,
        isFeatured: Boolean(body.isFeatured),
        rating: 5.0,
        reviewCount: 1,
        totalSold: 0,
        isDemo: false,
        createdAt: new Date().toISOString(),
      };
      db.state.products.unshift(newProduct);
      db.logAudit('PRODUCT_CREATED', req.user!.name, req.user!.role, `Added product '${newProduct.name}' ($${newProduct.basePrice})`);
      io.emit('menu:updated');
      res.status(201).json(newProduct);
    }
  );

  router.put(
    '/products/:id',
    requireAuth,
    requireRole(['owner', 'manager', 'kitchen']),
    (req: AuthenticatedRequest, res: Response) => {
      const idx = db.state.products.findIndex((p) => p.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const existing = db.state.products[idx];
      const body = req.body;
      const category = body.categoryId
        ? db.state.categories.find((c) => c.id === body.categoryId)
        : undefined;

      const updated: IProduct = {
        ...existing,
        ...body,
        id: existing.id,
        categoryName: category ? category.name : body.categoryName || existing.categoryName,
        basePrice: body.basePrice !== undefined ? Number(body.basePrice) : existing.basePrice,
      };
      db.state.products[idx] = updated;
      db.logAudit('PRODUCT_UPDATED', req.user!.name, req.user!.role, `Updated product '${updated.name}'`);
      io.emit('menu:updated');
      res.json(updated);
    }
  );

  router.delete(
    '/products/:id',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const idx = db.state.products.findIndex((p) => p.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const removed = db.state.products.splice(idx, 1)[0];
      db.logAudit('PRODUCT_DELETED', req.user!.name, req.user!.role, `Deleted product '${removed.name}'`);
      io.emit('menu:updated');
      res.json({ success: true });
    }
  );

  router.post('/reviews', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { productId, customerName, rating, comment } = req.body;
    const product = db.state.products.find((p) => p.id === productId);
    if (!product || !comment) {
      res.status(400).json({ error: 'Valid product and review comment are required.' });
      return;
    }
    const numRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const review = {
      id: `rev-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      customerId: req.user?.id,
      customerName: req.user?.name || String(customerName || 'Verified Guest').trim(),
      rating: numRating,
      comment: String(comment).trim(),
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    db.state.reviews.unshift(review);

    // Recalculate product rating
    const prodReviews = db.state.reviews.filter((r) => r.productId === product.id);
    const avg = prodReviews.reduce((sum, r) => sum + r.rating, 0) / prodReviews.length;
    product.rating = Number(avg.toFixed(1));
    product.reviewCount = prodReviews.length;

    db.saveToDisk();
    io.emit('menu:updated');
    res.status(201).json(review);
  });

  // ============================================================================
  // 4. COUPON VALIDATION & ORDER PROCESSING (ONLINE, POS, KDS, RIDER)
  // ============================================================================
  router.post('/coupons/validate', (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Enter a coupon code.' });
      return;
    }
    const codeUpper = String(code).trim().toUpperCase();
    const coupon = db.state.coupons.find((c) => c.code === codeUpper && c.isActive);
    if (!coupon) {
      res.status(404).json({ error: `Coupon '${codeUpper}' is invalid or inactive.` });
      return;
    }
    if (new Date(coupon.expiresAt) < new Date()) {
      res.status(400).json({ error: `Coupon '${codeUpper}' has expired.` });
      return;
    }
    const sub = Number(subtotal) || 0;
    if (sub < coupon.minOrderAmount) {
      res.status(400).json({
        error: `Coupon '${codeUpper}' requires a minimum subtotal of $${coupon.minOrderAmount.toFixed(2)}.`,
      });
      return;
    }
    let discount =
      coupon.discountType === 'percentage' ? (sub * coupon.discountValue) / 100 : coupon.discountValue;
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }
    discount = Math.min(sub, Number(discount.toFixed(2)));
    res.json({
      coupon,
      discountAmount: discount,
    });
  });

  router.post('/orders/calculate', (req, res) => {
    const result = computeOrderTotals({
      items: req.body.items || [],
      orderType: req.body.orderType || 'delivery',
      deliveryZoneName: req.body.deliveryZone,
      couponCode: req.body.couponCode,
      customDiscountAmount: Number(req.body.customDiscountAmount) || 0,
    });
    res.json(result);
  });

  router.get('/orders', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { status, orderType, customerId, riderId, search } = req.query;
    let list = [...db.state.orders];

    if (status && status !== 'all') {
      list = list.filter((o) => o.status === status);
    }
    if (orderType && orderType !== 'all') {
      list = list.filter((o) => o.orderType === orderType);
    }
    if (customerId) {
      list = list.filter((o) => o.customerId === customerId);
    }
    if (riderId) {
      list = list.filter((o) => o.assignedRiderId === riderId);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  });

  router.get('/orders/track/:orderNumber', (req, res) => {
    const code = String(req.params.orderNumber).trim().toUpperCase();
    const order = db.state.orders.find((o) => o.orderNumber.toUpperCase() === code || o.id === req.params.orderNumber);
    if (!order) {
      res.status(404).json({ error: `Order '${req.params.orderNumber}' not found.` });
      return;
    }
    res.json(order);
  });

  router.post('/orders', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Order must contain at least one item.' });
      return;
    }
    if (!body.customerName || !body.customerPhone) {
      res.status(400).json({ error: 'Customer name and phone number are required.' });
      return;
    }

    const calc = computeOrderTotals({
      items: body.items,
      orderType: body.orderType || 'delivery',
      deliveryZoneName: body.deliveryZone,
      couponCode: body.couponCode,
      customDiscountAmount: Number(body.customDiscountAmount) || 0,
    });

    if (calc.detailedItems.length === 0) {
      res.status(400).json({ error: 'No valid products found in order.' });
      return;
    }

    if (body.orderType === 'delivery' && calc.subtotal < calc.minOrderRequired) {
      res.status(400).json({
        error: `Minimum order subtotal for ${body.deliveryZone} is $${calc.minOrderRequired.toFixed(2)}.`,
      });
      return;
    }

    const nextSeq = 1041 + db.state.orders.length + 1;
    const orderNumber = `EO-${nextSeq}`;
    const isPosOrder = String(body.orderType).startsWith('pos-');
    const paymentMethod = body.paymentMethod || 'cash';
    const isImmediatePaid = paymentMethod === 'card' || paymentMethod === 'online' || (isPosOrder && body.markPaid !== false);

    const initialStatus: OrderStatus = isPosOrder ? 'Confirmed' : 'Pending';
    const nowIso = new Date().toISOString();

    const newOrder: IOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerId: req.user?.id || body.customerId,
      customerName: String(body.customerName).trim(),
      customerPhone: String(body.customerPhone).trim(),
      customerEmail: body.customerEmail ? String(body.customerEmail).trim() : undefined,
      orderType: body.orderType || 'delivery',
      tableNumber: body.tableNumber ? String(body.tableNumber).trim() : undefined,
      deliveryAddress: body.deliveryAddress ? String(body.deliveryAddress).trim() : undefined,
      deliveryZone: body.deliveryZone,
      items: calc.detailedItems,
      subtotal: calc.subtotal,
      taxAmount: calc.taxAmount,
      deliveryFee: calc.deliveryFee,
      discountAmount: calc.discountAmount,
      couponCode: calc.appliedCouponCode,
      totalAmount: calc.totalAmount,
      estimatedCost: calc.estimatedCost,
      paymentMethod,
      paymentStatus: isImmediatePaid ? 'Paid' : 'Pending',
      status: initialStatus,
      orderNotes: body.orderNotes ? String(body.orderNotes).trim() : undefined,
      cashCollected: isImmediatePaid,
      estimatedDeliveryMinutes: calc.estimatedDeliveryMinutes,
      inventoryDeducted: false,
      statusHistory: [
        {
          status: initialStatus,
          timestamp: nowIso,
          updatedBy: req.user?.name || String(body.customerName).trim(),
        },
      ],
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.state.orders.unshift(newOrder);

    // Update product sales counters
    for (const item of newOrder.items) {
      const prod = db.state.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.totalSold = (prod.totalSold || 0) + item.quantity;
      }
    }

    // Increment coupon usage
    if (calc.appliedCouponCode) {
      const coup = db.state.coupons.find((c) => c.code === calc.appliedCouponCode);
      if (coup) coup.usageCount += 1;
    }

    // Award customer loyalty points
    if (newOrder.customerId) {
      const cust = db.state.users.find((u) => u.id === newOrder.customerId);
      if (cust) {
        const earned = Math.floor(newOrder.totalAmount * (db.state.settings.loyaltyPointsPerDollar / 10));
        cust.loyaltyPoints += earned;
      }
    }

    // Record payment if paid
    if (isImmediatePaid) {
      db.state.payments.unshift({
        id: `pay-${Date.now()}`,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        amount: newOrder.totalAmount,
        method: newOrder.paymentMethod,
        status: 'Paid',
        transactionRef: `TXN-${Date.now().toString().slice(-6)}`,
        processedBy: req.user?.name || 'Online Checkout',
        createdAt: nowIso,
      });
    }

    db.logAudit(
      'ORDER_CREATED',
      req.user?.name || newOrder.customerName,
      req.user?.role || 'customer',
      `Created Order #${newOrder.orderNumber} (${newOrder.orderType}) Total: $${newOrder.totalAmount.toFixed(2)}`
    );

    io.emit('order:created', newOrder);
    io.emit('notification:broadcast', {
      id: `notif-${Date.now()}`,
      title: `New Order #${newOrder.orderNumber}`,
      message: `${newOrder.customerName} placed a ${newOrder.orderType} order ($${newOrder.totalAmount.toFixed(2)})`,
      timestamp: nowIso,
    });

    res.status(201).json(newOrder);
  });

  // Update Order Status (Kitchen Display, POS, Admin, Rider)
  router.patch(
    '/orders/:id/status',
    optionalAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const order = db.state.orders.find((o) => o.id === req.params.id || o.orderNumber === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const { status, assignedRiderId } = req.body as { status: OrderStatus; assignedRiderId?: string };
      if (!status) {
        res.status(400).json({ error: 'New status is required.' });
        return;
      }

      const actorName = req.user?.name || 'Staff Member';
      const nowIso = new Date().toISOString();
      order.status = status;
      order.updatedAt = nowIso;

      if (status === 'Preparing' && !order.prepStartedAt) {
        order.prepStartedAt = nowIso;
      }
      if (status === 'Ready') {
        order.readyAt = nowIso;
      }
      if (status === 'Delivered') {
        order.deliveredAt = nowIso;
        if (order.paymentMethod === 'cash' && !order.cashCollected) {
          order.cashCollected = true;
          order.paymentStatus = 'Paid';
          db.state.payments.unshift({
            id: `pay-${Date.now()}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: order.totalAmount,
            method: 'cash',
            status: 'Paid',
            transactionRef: `COD-${order.orderNumber}`,
            processedBy: actorName,
            createdAt: nowIso,
          });
        }
      }

      // Automatically deduct recipe ingredients when order enters Preparing, Ready, or Delivered
      if (['Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(status) && !order.inventoryDeducted) {
        deductOrderInventory(order, actorName);
      }

      if (assignedRiderId) {
        const rider = db.state.users.find((u) => u.id === assignedRiderId);
        if (rider) {
          order.assignedRiderId = rider.id;
          order.assignedRiderName = rider.name;
        }
      }

      order.statusHistory.push({
        status,
        timestamp: nowIso,
        updatedBy: actorName,
      });

      db.logAudit(
        'ORDER_STATUS_UPDATED',
        actorName,
        req.user?.role || 'kitchen',
        `Order #${order.orderNumber} marked as '${status}'`
      );

      io.emit('order:updated', order);
      io.emit('notification:broadcast', {
        id: `notif-${Date.now()}`,
        title: `Order #${order.orderNumber} → ${status}`,
        message: `Updated by ${actorName}`,
        timestamp: nowIso,
      });

      res.json(order);
    }
  );

  // Assign Rider to Delivery Order
  router.patch(
    '/orders/:id/assign-rider',
    optionalAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const order = db.state.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const { riderId } = req.body;
      const rider = db.state.users.find((u) => u.id === riderId && u.role === 'rider');
      if (!rider) {
        res.status(400).json({ error: 'Valid delivery rider required.' });
        return;
      }
      order.assignedRiderId = rider.id;
      order.assignedRiderName = rider.name;
      order.updatedAt = new Date().toISOString();

      db.logAudit(
        'RIDER_ASSIGNED',
        req.user?.name || 'Dispatcher',
        req.user?.role || 'manager',
        `Assigned ${rider.name} to Order #${order.orderNumber}`
      );

      io.emit('order:updated', order);
      res.json(order);
    }
  );

  // Collect Cash & Confirm Payment (Rider or POS Cashier)
  router.patch(
    '/orders/:id/collect-cash',
    optionalAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const order = db.state.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const nowIso = new Date().toISOString();
      const actorName = req.user?.name || 'Delivery Rider';
      order.cashCollected = true;
      order.paymentStatus = 'Paid';
      order.updatedAt = nowIso;

      if (req.body.markDelivered && order.status !== 'Delivered') {
        order.status = 'Delivered';
        order.deliveredAt = nowIso;
        if (!order.inventoryDeducted) {
          deductOrderInventory(order, actorName);
        }
        order.statusHistory.push({
          status: 'Delivered',
          timestamp: nowIso,
          updatedBy: actorName,
        });
      }

      db.state.payments.unshift({
        id: `pay-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        method: order.paymentMethod,
        status: 'Paid',
        transactionRef: `CASH-${order.orderNumber}`,
        processedBy: actorName,
        createdAt: nowIso,
      });

      db.logAudit(
        'CASH_COLLECTED',
        actorName,
        req.user?.role || 'rider',
        `Collected $${order.totalAmount.toFixed(2)} for Order #${order.orderNumber}`
      );

      io.emit('order:updated', order);
      res.json(order);
    }
  );

  // Refund & Cancel Order (POS / Admin)
  router.post(
    '/orders/:id/refund',
    requireAuth,
    requireRole(['owner', 'manager', 'cashier']),
    (req: AuthenticatedRequest, res: Response) => {
      const order = db.state.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const reason = String(req.body.reason || 'Customer requested cancellation & refund').trim();
      const nowIso = new Date().toISOString();

      order.status = 'Cancelled';
      order.paymentStatus = 'Refunded' as PaymentStatus;
      order.updatedAt = nowIso;
      order.statusHistory.push({
        status: 'Cancelled',
        timestamp: nowIso,
        updatedBy: req.user!.name,
      });

      const refundRecord = {
        id: `ref-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        reason,
        approvedBy: req.user!.name,
        createdAt: nowIso,
      };
      db.state.refunds.unshift(refundRecord);

      db.logAudit(
        'ORDER_REFUNDED',
        req.user!.name,
        req.user!.role,
        `Refunded $${order.totalAmount.toFixed(2)} for Order #${order.orderNumber}. Reason: ${reason}`
      );

      io.emit('order:updated', order);
      res.json({ order, refund: refundRecord });
    }
  );

  // ============================================================================
  // 5. INVENTORY, RECIPES & SUPPLIERS
  // ============================================================================
  router.get('/inventory', (_req, res) => {
    res.json({
      inventory: db.state.inventory,
      suppliers: db.state.suppliers,
    });
  });

  router.post(
    '/inventory',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const b = req.body;
      if (!b.name || !b.unit) {
        res.status(400).json({ error: 'Ingredient name and unit are required.' });
        return;
      }
      const sup = db.state.suppliers.find((s) => s.id === b.supplierId);
      const item = {
        id: `inv-${Date.now()}`,
        name: String(b.name).trim(),
        category: b.category || 'Flour & Dough',
        currentStock: Number(b.currentStock) || 0,
        unit: String(b.unit).trim(),
        minStockLevel: Number(b.minStockLevel) || 10,
        costPerUnit: Number(b.costPerUnit) || 1,
        supplierId: sup?.id,
        supplierName: sup?.name || b.supplierName || 'Direct Supplier',
        expiryDate: b.expiryDate || '2027-06-30',
        wastageLogged: 0,
        lastRestockedAt: new Date().toISOString().split('T')[0],
        isDemo: false,
      };
      db.state.inventory.push(item);
      db.logAudit('INVENTORY_ITEM_CREATED', req.user!.name, req.user!.role, `Added ingredient '${item.name}'`);
      io.emit('inventory:updated', db.state.inventory);
      res.status(201).json(item);
    }
  );

  router.post(
    '/inventory/:id/adjust',
    requireAuth,
    requireRole(['owner', 'manager', 'kitchen']),
    (req: AuthenticatedRequest, res: Response) => {
      const item = db.state.inventory.find((i) => i.id === req.params.id);
      if (!item) {
        res.status(404).json({ error: 'Inventory item not found.' });
        return;
      }
      const { type, quantity, notes, recordPurchaseExpense } = req.body;
      const qty = Math.max(0, Number(quantity) || 0);
      if (qty <= 0) {
        res.status(400).json({ error: 'Quantity must be greater than zero.' });
        return;
      }

      if (type === 'restock') {
        item.currentStock = Number((item.currentStock + qty).toFixed(2));
        item.lastRestockedAt = new Date().toISOString().split('T')[0];

        if (recordPurchaseExpense) {
          const purchaseCost = Number((qty * item.costPerUnit).toFixed(2));
          db.state.expenses.unshift({
            id: `exp-${Date.now()}`,
            title: `Restock: ${qty} ${item.unit} ${item.name}`,
            category: 'Ingredient Purchase',
            amount: purchaseCost,
            date: new Date().toISOString().split('T')[0],
            paidTo: item.supplierName || 'Supplier',
            paymentMethod: 'online',
            notes: notes || 'Auto-logged from inventory restock',
            recordedBy: req.user!.name,
            isDemo: false,
          });
        }
      } else if (type === 'wastage') {
        item.currentStock = Math.max(0, Number((item.currentStock - qty).toFixed(2)));
        item.wastageLogged = Number((item.wastageLogged + qty).toFixed(2));
      } else if (type === 'deduct') {
        item.currentStock = Math.max(0, Number((item.currentStock - qty).toFixed(2)));
      }

      db.logAudit(
        `INVENTORY_${String(type).toUpperCase()}`,
        req.user!.name,
        req.user!.role,
        `${type}: ${qty} ${item.unit} of ${item.name}. New stock: ${item.currentStock} ${item.unit}`
      );

      io.emit('inventory:updated', db.state.inventory);
      res.json(item);
    }
  );

  router.post(
    '/suppliers',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const b = req.body;
      if (!b.name || !b.phone) {
        res.status(400).json({ error: 'Supplier name and phone are required.' });
        return;
      }
      const sup = {
        id: `sup-${Date.now()}`,
        name: String(b.name).trim(),
        contactPerson: String(b.contactPerson || 'Account Manager').trim(),
        phone: String(b.phone).trim(),
        email: String(b.email || 'orders@supplier.com').trim(),
        itemsSupplied: Array.isArray(b.itemsSupplied) ? b.itemsSupplied : [],
        totalPurchasesAmount: Number(b.totalPurchasesAmount) || 0,
        balanceDue: Number(b.balanceDue) || 0,
        lastSupplyDate: new Date().toISOString().split('T')[0],
        isDemo: false,
      };
      db.state.suppliers.push(sup);
      db.logAudit('SUPPLIER_ADDED', req.user!.name, req.user!.role, `Added supplier '${sup.name}'`);
      res.status(201).json(sup);
    }
  );

  // ============================================================================
  // 6. STAFF, EXPENSES, COUPONS, CUSTOMERS CRM & MOBILE INSTALL TRACKING
  // ============================================================================
  router.post('/telemetry/app-install', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { platform, userAgent, standalone } = req.body;
    const actorName = req.user?.name || req.body.userName || 'Mobile App User';
    const actorRole = req.user?.role || 'customer';
    const deviceInfo = `${platform || 'Mobile Device'} (${standalone ? 'Standalone Home Screen App' : 'PWA Install Prompt'})`;

    db.logAudit(
      'MOBILE_APP_INSTALLED',
      actorName,
      actorRole,
      `Installed / Launched Mobile App on ${deviceInfo} — ${String(userAgent || '').slice(0, 80)}`
    );

    io.emit('notification:broadcast', {
      id: `notif-${Date.now()}`,
      title: 'New Mobile App Install!',
      message: `${actorName} installed Ember & Oak on ${platform || 'Mobile'}`,
      timestamp: new Date().toISOString(),
    });
    io.emit('menu:updated');
    res.status(201).json({ success: true });
  });

  router.get('/management', requireAuth, (_req, res) => {
    // Build comprehensive Customer CRM profiles combining registered users + guest orderers
    const customerMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        phone: string;
        loyaltyPoints: number;
        accountType: 'Registered Account' | 'Guest Checkout';
        addresses: string[];
        totalOrders: number;
        totalSpent: number;
        lastOrderAt?: string;
        recentItems: string[];
        createdAt: string;
      }
    >();

    for (const u of db.state.users.filter((usr) => usr.role === 'customer')) {
      customerMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        loyaltyPoints: u.loyaltyPoints,
        accountType: 'Registered Account',
        addresses: (u.savedAddresses || []).map((a) => `${a.label}: ${a.street} (${a.zone})`),
        totalOrders: 0,
        totalSpent: 0,
        recentItems: [],
        createdAt: u.createdAt,
      });
    }

    for (const ord of db.state.orders) {
      const key =
        ord.customerId && customerMap.has(ord.customerId)
          ? ord.customerId
          : `guest-${ord.customerPhone || ord.customerName}`;

      const existing = customerMap.get(key) || {
        id: key,
        name: ord.customerName,
        email: ord.customerEmail || 'Guest (No Email)',
        phone: ord.customerPhone,
        loyaltyPoints: 0,
        accountType: 'Guest Checkout' as const,
        addresses: ord.deliveryAddress ? [ord.deliveryAddress] : [],
        totalOrders: 0,
        totalSpent: 0,
        recentItems: [],
        createdAt: ord.createdAt,
      };

      if (ord.status !== 'Cancelled') {
        existing.totalOrders += 1;
        existing.totalSpent = Number((existing.totalSpent + ord.totalAmount).toFixed(2));
      }
      if (!existing.lastOrderAt || new Date(ord.createdAt) > new Date(existing.lastOrderAt)) {
        existing.lastOrderAt = ord.createdAt;
      }
      if (ord.deliveryAddress && !existing.addresses.includes(ord.deliveryAddress)) {
        existing.addresses.push(ord.deliveryAddress);
      }
      for (const item of ord.items) {
        const label = `${item.quantity}× ${item.productName}`;
        if (existing.recentItems.length < 6 && !existing.recentItems.includes(label)) {
          existing.recentItems.push(label);
        }
      }
      customerMap.set(key, existing);
    }

    res.json({
      staff: db.state.staff,
      expenses: db.state.expenses,
      coupons: db.state.coupons,
      suppliers: db.state.suppliers,
      settings: db.state.settings,
      customers: Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent),
      auditLogs: db.state.auditLogs.slice(0, 100),
    });
  });

  router.post(
    '/staff',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const b = req.body;
      if (!b.name || !b.email || !b.role) {
        res.status(400).json({ error: 'Name, email, and role are required.' });
        return;
      }
      const member = {
        id: `staff-${Date.now()}`,
        name: String(b.name).trim(),
        email: String(b.email).toLowerCase().trim(),
        phone: String(b.phone || '+1-555-0190').trim(),
        role: b.role,
        salaryMonthly: Number(b.salaryMonthly) || 3000,
        shift: b.shift || 'Morning (09:00 - 17:00)',
        attendanceToday: 'Present' as const,
        daysPresentThisMonth: 1,
        status: 'Active' as const,
        joinedDate: new Date().toISOString().split('T')[0],
        isDemo: false,
      };
      db.state.staff.push(member);
      db.logAudit('STAFF_HIRED', req.user!.name, req.user!.role, `Added staff member ${member.name} (${member.role})`);
      res.status(201).json(member);
    }
  );

  router.patch(
    '/staff/:id/attendance',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const member = db.state.staff.find((s) => s.id === req.params.id);
      if (!member) {
        res.status(404).json({ error: 'Staff member not found.' });
        return;
      }
      const { attendanceToday } = req.body;
      member.attendanceToday = attendanceToday;
      if (attendanceToday === 'Present') {
        member.daysPresentThisMonth = Math.min(31, member.daysPresentThisMonth + 1);
      }
      db.logAudit(
        'STAFF_ATTENDANCE_UPDATED',
        req.user!.name,
        req.user!.role,
        `Marked ${member.name} as ${attendanceToday}`
      );
      res.json(member);
    }
  );

  router.post(
    '/expenses',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const b = req.body;
      if (!b.title || !b.amount) {
        res.status(400).json({ error: 'Expense title and amount are required.' });
        return;
      }
      const exp = {
        id: `exp-${Date.now()}`,
        title: String(b.title).trim(),
        category: b.category || 'Ingredient Purchase',
        amount: Number(b.amount),
        date: b.date || new Date().toISOString().split('T')[0],
        paidTo: String(b.paidTo || 'Vendor').trim(),
        paymentMethod: b.paymentMethod || 'online',
        notes: b.notes ? String(b.notes).trim() : undefined,
        recordedBy: req.user!.name,
        isDemo: false,
      };
      db.state.expenses.unshift(exp);
      db.logAudit(
        'EXPENSE_RECORDED',
        req.user!.name,
        req.user!.role,
        `Logged expense '${exp.title}' ($${exp.amount.toFixed(2)})`
      );
      res.status(201).json(exp);
    }
  );

  router.post(
    '/coupons',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const b = req.body;
      if (!b.code || !b.discountValue) {
        res.status(400).json({ error: 'Coupon code and discount value are required.' });
        return;
      }
      const coupon = {
        id: `coup-${Date.now()}`,
        code: String(b.code).trim().toUpperCase(),
        description: String(b.description || 'Promotional discount').trim(),
        discountType: b.discountType === 'fixed' ? ('fixed' as const) : ('percentage' as const),
        discountValue: Number(b.discountValue),
        minOrderAmount: Number(b.minOrderAmount) || 0,
        maxDiscountAmount: b.maxDiscountAmount ? Number(b.maxDiscountAmount) : undefined,
        usageCount: 0,
        usageLimit: Number(b.usageLimit) || 500,
        expiresAt: b.expiresAt || '2027-12-31',
        isActive: true,
        isDemo: false,
      };
      db.state.coupons.unshift(coupon);
      db.logAudit('COUPON_CREATED', req.user!.name, req.user!.role, `Created coupon ${coupon.code}`);
      io.emit('menu:updated');
      res.status(201).json(coupon);
    }
  );

  router.patch(
    '/coupons/:id/toggle',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      const coupon = db.state.coupons.find((c) => c.id === req.params.id);
      if (!coupon) {
        res.status(404).json({ error: 'Coupon not found.' });
        return;
      }
      coupon.isActive = !coupon.isActive;
      db.saveToDisk();
      io.emit('menu:updated');
      res.json(coupon);
    }
  );

  router.put(
    '/settings',
    requireAuth,
    requireRole(['owner', 'manager']),
    (req: AuthenticatedRequest, res: Response) => {
      db.state.settings = {
        ...db.state.settings,
        ...req.body,
        id: 'settings-main',
      };
      db.logAudit('SETTINGS_UPDATED', req.user!.name, req.user!.role, 'Updated restaurant & delivery zone settings.');
      io.emit('menu:updated');
      res.json(db.state.settings);
    }
  );

  // ============================================================================
  // 7. ADMIN ANALYTICS, FINANCIAL REPORTS & DATA MODE SWITCH
  // ============================================================================
  router.get('/analytics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { period = 'daily', excludeDemo = 'false' } = req.query;
    const filterDemo = excludeDemo === 'true';

    const orders = db.state.orders.filter((o) => (!filterDemo || !o.isDemo) && o.status !== 'Cancelled');
    const cancelledOrders = db.state.orders.filter((o) => (!filterDemo || !o.isDemo) && o.status === 'Cancelled');
    const expenses = db.state.expenses.filter((e) => !filterDemo || !e.isDemo);

    const totalRevenue = Number(orders.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2));
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
    const totalIngredientCOGS = Number(orders.reduce((sum, o) => sum + (o.estimatedCost || 0), 0).toFixed(2));
    const grossProfit = Number((totalRevenue - totalIngredientCOGS).toFixed(2));
    const totalOperatingExpenses = Number(expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2));
    const netProfit = Number((grossProfit - totalOperatingExpenses).toFixed(2));

    const pendingDeliveries = orders.filter((o) =>
      ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)
    ).length;

    const lowStockItems = db.state.inventory.filter((i) => i.currentStock <= i.minStockLevel);

    // Bestselling products calculated directly from orders
    const productSalesMap = new Map<string, { id: string; name: string; category: string; unitsSold: number; revenue: number }>();
    for (const ord of orders) {
      for (const item of ord.items) {
        const current = productSalesMap.get(item.productId) || {
          id: item.productId,
          name: item.productName,
          category: db.state.products.find((p) => p.id === item.productId)?.categoryName || 'Menu',
          unitsSold: 0,
          revenue: 0,
        };
        current.unitsSold += item.quantity;
        current.revenue = Number((current.revenue + item.lineTotal).toFixed(2));
        productSalesMap.set(item.productId, current);
      }
    }
    const bestsellingProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Build time-series chart data based on requested period (daily, weekly, monthly, yearly)
    const labels: string[] = [];
    const revenueSeries: number[] = [];
    const ordersSeries: number[] = [];

    const nowTime = new Date();
    if (period === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(nowTime.getTime() - i * 86400000);
        const dayStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        const dayOrders = orders.filter((o) => o.createdAt.startsWith(dayStr));
        revenueSeries.push(Number(dayOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)));
        ordersSeries.push(dayOrders.length);
      }
    } else if (period === 'weekly') {
      for (let w = 3; w >= 0; w--) {
        const start = new Date(nowTime.getTime() - (w + 1) * 7 * 86400000);
        const end = new Date(nowTime.getTime() - w * 7 * 86400000);
        labels.push(`Week -${w === 0 ? 'Current' : w}`);
        const wkOrders = orders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
        revenueSeries.push(Number(wkOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)));
        ordersSeries.push(wkOrders.length);
      }
    } else if (period === 'monthly') {
      for (let m = 5; m >= 0; m--) {
        const d = new Date(nowTime.getFullYear(), nowTime.getMonth() - m, 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        const moOrders = orders.filter((o) => o.createdAt.startsWith(prefix));
        revenueSeries.push(Number(moOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)));
        ordersSeries.push(moOrders.length);
      }
    } else {
      for (let y = 2; y >= 0; y--) {
        const yr = String(nowTime.getFullYear() - y);
        labels.push(yr);
        const yrOrders = orders.filter((o) => o.createdAt.startsWith(yr));
        revenueSeries.push(Number(yrOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)));
        ordersSeries.push(yrOrders.length);
      }
    }

    res.json({
      dataMode: db.state.dataMode,
      metrics: {
        totalRevenue,
        totalOrders,
        cancelledOrdersCount: cancelledOrders.length,
        avgOrderValue,
        totalIngredientCOGS,
        grossProfit,
        totalOperatingExpenses,
        netProfit,
        pendingDeliveries,
        lowStockCount: lowStockItems.length,
      },
      bestsellingProducts,
      lowStockItems,
      chartData: {
        labels,
        revenueSeries,
        ordersSeries,
      },
      payments: db.state.payments.slice(0, 50),
      refunds: db.state.refunds,
      expenses,
    });
  });

  // Switch between Demo Data Mode and Clean Production Mode
  router.post(
    '/admin/data-mode',
    requireAuth,
    requireRole(['owner']),
    (req: AuthenticatedRequest, res: Response) => {
      const mode = req.body.mode === 'production' ? 'production' : 'demo';
      db.switchDataMode(mode, req.user!.name);
      io.emit('menu:updated');
      io.emit('inventory:updated', db.state.inventory);
      res.json({ dataMode: db.state.dataMode, message: `Switched database to ${mode} mode.` });
    }
  );

  return router;
}
