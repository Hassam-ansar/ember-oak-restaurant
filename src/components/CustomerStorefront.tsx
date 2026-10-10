import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  Plus,
  Minus,
  X,
  Check,
  MapPin,
  Clock,
  RotateCcw,
  Star,
  Truck,
  Utensils,
  PackageCheck,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  IProduct,
  IProductOption,
  IOrder,
  OrderType,
  PaymentMethod,
} from '../types/restaurant';
import { SafeFoodImage } from './SafeFoodImage';

export const CustomerStorefront: React.FC = () => {
  const {
    settings,
    categories,
    products,
    orders,
    coupons,
    reviews,
    user,
    cart,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    toggleFavorite,
    reorderPastOrder,
    apiFetch,
    pushNotification,
    refreshAll,
  } = useRestaurant();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [onlyFeatured, setOnlyFeatured] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  // Product Customization Modal State
  const [activeProduct, setActiveProduct] = useState<IProduct | null>(null);
  const [customQty, setCustomQty] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<IProductOption | undefined>(undefined);
  const [selectedCrust, setSelectedCrust] = useState<IProductOption | undefined>(undefined);
  const [selectedToppings, setSelectedToppings] = useState<IProductOption[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<IProductOption[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [modalTab, setModalTab] = useState<'customize' | 'reviews'>('customize');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Order Tracking & Customer History Modal State
  const [trackOrderInput, setTrackOrderInput] = useState<string>('');
  const [trackedOrder, setTrackedOrder] = useState<IOrder | null>(null);
  const [showOrderHistoryModal, setShowOrderHistoryModal] = useState<boolean>(false);
  const [localOrderIds, setLocalOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('eo_my_order_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Checkout Form State (Customer uses their own details)
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [customerName, setCustomerName] = useState<string>(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [deliveryZone, setDeliveryZone] = useState<string>(
    settings?.deliveryZones[0]?.name || 'Downtown & Culinary District (0–3 km)'
  );
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    user?.savedAddresses?.[0]?.street || ''
  );
  const [tableNumber, setTableNumber] = useState<string>('Table 01');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);

  // Sync user defaults when user logs in or logs out
  React.useEffect(() => {
    if (user) {
      setCustomerName(user.name || '');
      setCustomerPhone(user.phone || '');
      setCustomerEmail(user.email || '');
      if (user.savedAddresses && user.savedAddresses.length > 0) {
        setDeliveryAddress(user.savedAddresses[0].street);
        setDeliveryZone(user.savedAddresses[0].zone);
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setDeliveryAddress('');
    }
  }, [user]);

  const openProductModal = (product: IProduct) => {
    setActiveProduct(product);
    setCustomQty(1);
    setSelectedSize(product.sizes[0]);
    setSelectedCrust(product.crusts[0]);
    setSelectedToppings([]);
    setSelectedAddOns([]);
    setSpecialInstructions('');
    setModalTab('customize');
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (onlyFavorites && (!user || !user.favorites.includes(p.id))) return false;
      if (onlyFeatured && !p.isFeatured) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchCat = p.categoryName.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [products, selectedCategory, onlyFavorites, onlyFeatured, searchQuery, user]);

  // Calculate active customization unit price
  const customUnitPrice = useMemo(() => {
    if (!activeProduct) return 0;
    const sz = selectedSize?.price || 0;
    const cr = selectedCrust?.price || 0;
    const tp = selectedToppings.reduce((s, t) => s + t.price, 0);
    const ao = selectedAddOns.reduce((s, a) => s + a.price, 0);
    return Number((activeProduct.basePrice + sz + cr + tp + ao).toFixed(2));
  }, [activeProduct, selectedSize, selectedCrust, selectedToppings, selectedAddOns]);

  // Cart Totals Calculation
  const cartTotals = useMemo(() => {
    const subtotal = Number(cart.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
    const zoneObj =
      settings?.deliveryZones.find((z) => z.name === deliveryZone) || settings?.deliveryZones[0];
    const deliveryFee =
      orderType === 'delivery' ? (subtotal >= 50 || subtotal === 0 ? 0 : zoneObj?.fee || 2.99) : 0;
    const minOrder = orderType === 'delivery' ? zoneObj?.minOrder || 15 : 0;
    const estimatedMinutes = orderType === 'delivery' ? zoneObj?.estimatedMinutes || 30 : 18;
    const discountAmount = appliedCoupon ? Math.min(subtotal, appliedCoupon.discountAmount) : 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxRate = settings?.taxRatePercent || 8.5;
    const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
    const totalAmount = Number((taxable + taxAmount + deliveryFee).toFixed(2));

    return {
      subtotal,
      deliveryFee,
      minOrder,
      estimatedMinutes,
      discountAmount,
      taxAmount,
      totalAmount,
    };
  }, [cart, orderType, deliveryZone, appliedCoupon, settings]);

  const handleApplyCoupon = async (codeToUse?: string) => {
    const code = (codeToUse ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    try {
      const res = await apiFetch<{ coupon: { code: string }; discountAmount: number }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code, subtotal: cartTotals.subtotal }),
        }
      );
      setAppliedCoupon({ code: res.coupon.code, discountAmount: res.discountAmount });
      setCouponInput(res.coupon.code);
      pushNotification('Coupon Applied', `Saved $${res.discountAmount.toFixed(2)} with ${res.coupon.code}`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError((err as Error).message);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (orderType === 'delivery' && cartTotals.subtotal < cartTotals.minOrder) {
      pushNotification(
        'Minimum Order Not Met',
        `Minimum subtotal for ${deliveryZone} is $${cartTotals.minOrder.toFixed(2)}.`
      );
      return;
    }

    setPlacingOrder(true);
    try {
      const payload = {
        customerId: user?.id,
        customerName,
        customerPhone,
        customerEmail,
        orderType,
        deliveryZone: orderType === 'delivery' ? deliveryZone : undefined,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        orderNotes,
        paymentMethod,
        couponCode: appliedCoupon?.code,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          selectedSizeName: c.selectedSize?.name,
          selectedCrustName: c.selectedCrust?.name,
          selectedToppingNames: c.selectedToppings.map((t) => t.name),
          selectedAddOnNames: c.selectedAddOns.map((a) => a.name),
          specialInstructions: c.specialInstructions,
        })),
      };

      const createdOrder = await apiFetch<IOrder>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const updatedLocalIds = [createdOrder.id, ...localOrderIds];
      setLocalOrderIds(updatedLocalIds);
      try {
        localStorage.setItem('eo_my_order_ids', JSON.stringify(updatedLocalIds));
      } catch {
        // Ignore storage error
      }

      // Send email notification to hassam.ansar22007@gmail.com
      fetch('https://formsubmit.co/ajax/hassam.ansar22007@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: `[Ember & Oak] New Order #${createdOrder.orderNumber} ($${createdOrder.totalAmount.toFixed(2)}) — ${createdOrder.customerName}`,
          _template: 'table',
          _captcha: 'false',
          Event: 'New Customer Food Order Placed',
          Order_Number: `#${createdOrder.orderNumber}`,
          Customer_Name: createdOrder.customerName,
          Customer_Phone: createdOrder.customerPhone,
          Customer_Email: createdOrder.customerEmail || 'Guest Customer',
          Order_Type: createdOrder.orderType.toUpperCase(),
          Delivery_Address: createdOrder.deliveryAddress || createdOrder.tableNumber || 'Takeaway',
          Items_Ordered: createdOrder.items
            .map((i) => `${i.quantity}x ${i.productName} ($${i.lineTotal.toFixed(2)})`)
            .join(', '),
          Total_Amount: `$${createdOrder.totalAmount.toFixed(2)}`,
          Payment_Method: `${createdOrder.paymentMethod.toUpperCase()} (${createdOrder.paymentStatus})`,
          Time: new Date().toLocaleString(),
        }),
      }).catch(() => {});

      clearCart();
      setAppliedCoupon(null);
      setIsCartOpen(false);
      setTrackedOrder(createdOrder);
      refreshAll();
    } catch (err) {
      pushNotification('Checkout Error', (err as Error).message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleTrackOrderSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackOrderInput.trim()) return;
    try {
      const ord = await apiFetch<IOrder>(`/api/orders/track/${encodeURIComponent(trackOrderInput.trim())}`);
      setTrackedOrder(ord);
    } catch (err) {
      pushNotification('Order Lookup', (err as Error).message);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct || !reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: activeProduct.id,
          customerName: user?.name || customerName || 'Verified Guest',
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setReviewComment('');
      pushNotification('Review Published', 'Thank you for reviewing this dish!');
      await refreshAll();
    } catch (err) {
      pushNotification('Review Error', (err as Error).message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Sync live updates into trackedOrder if open
  const liveTrackedOrder = useMemo(() => {
    if (!trackedOrder) return null;
    return orders.find((o) => o.id === trackedOrder.id) || trackedOrder;
  }, [orders, trackedOrder]);

  // Only show this specific customer's own order history (never show other people's/demo orders)
  const customerOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.isDemo) return false;
      if (localOrderIds.includes(o.id)) return true;
      if (user) {
        return (
          o.customerId === user.id ||
          (o.customerEmail && o.customerEmail.toLowerCase() === user.email.toLowerCase())
        );
      }
      return false;
    });
  }, [orders, user, localOrderIds]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Slim Dismissible Promotional Banner (<= 40px height per E-Commerce rules) */}
      {!bannerDismissed && settings?.promotionalBannerText && (
        <div className="bg-stone-900 text-stone-100 h-9 px-4 flex items-center justify-between text-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <p className="truncate font-medium tracking-wide">{settings.promotionalBannerText}</p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-stone-400 hover:text-white ml-4 shrink-0"
              aria-label="Dismiss promotional banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: Storefront Split Hero */}
      <section className="bg-stone-950 text-stone-100 border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-widest uppercase text-amber-400">
                Wood-Fired Kiln · Black Angus Grill · Fast Dispatch
              </p>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Artisanal Sourdough Pizzas &amp; Smashed Craft Burgers
              </h1>
              <p className="text-stone-300 text-base leading-relaxed max-w-xl">
                48-hour fermented Italian 00 dough, Royal Crown Crust pizzas, double Black Angus smash burgers, and charcoal-grilled shawarmas delivered piping hot to your door.
              </p>
            </div>

            {/* Primary CTA & Live Order Tracker Lookup */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#menu-section"
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Full Menu
                </a>
                <button
                  onClick={() => setShowOrderHistoryModal(true)}
                  className="px-5 py-3 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Order History &amp; Reorder ({customerOrders.length})
                </button>
              </div>

              <form onSubmit={handleTrackOrderSearch} className="flex items-center gap-2 max-w-md pt-2">
                <input
                  type="text"
                  value={trackOrderInput}
                  onChange={(e) => setTrackOrderInput(e.target.value)}
                  placeholder="Track order (e.g. EO-1043 or EO-1044)..."
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold rounded-lg border border-stone-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Track Live
                </button>
              </form>
            </div>

            {/* Clean Restaurant Details in Mid Section (No Owner/Manager Details) */}
            <div className="pt-4 border-t border-stone-800/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-400">
              <span>
                Restaurant:{' '}
                <strong className="text-stone-200">
                  {settings?.restaurantName || 'Ember & Oak Kitchen'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Address:{' '}
                <strong className="text-stone-200">
                  {settings?.address || '742 Artisan Avenue, Culinary District'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Phone:{' '}
                <strong className="text-amber-400 font-mono tabular-nums">
                  {settings?.phone || '+1 (555) 234-8910'}
                </strong>
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-stone-800 min-h-[300px]">
            <SafeFoodImage
              src="/src/assets/images/hero_artisan_pizza_feast_1791612739930.jpg"
              alt="Wood-fired pepperoni pizza, double smash burger, and loaded cheese fries"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end p-6">
              <div className="flex items-center justify-between w-full text-white">
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-300 font-medium">
                    Featured Family Bundle
                  </p>
                  <p className="text-lg font-display font-bold">
                    The Grand Ember Family Feast (Serves 4–6)
                  </p>
                </div>
                <button
                  onClick={() => {
                    const deal = products.find((p) => p.id === 'prod-deal-family') || products[0];
                    if (deal) openProductModal(deal);
                  }}
                  className="px-4 py-2 bg-white text-stone-950 hover:bg-amber-50 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Customize · $49.90
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Menu Navigation, Search & Interactive Filters */}
      <section id="menu-section" className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-stone-900 tracking-tight">
              Crafted Menu &amp; Custom Creations
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Select any dish to customize size, crust, extra toppings, and savory add-ons.
            </p>
          </div>

          {/* Search & Quick Filter Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pizza, smash, shawarma..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
              />
            </div>

            <button
              onClick={() => setOnlyFeatured(!onlyFeatured)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                onlyFeatured
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              Chef Signatures
            </button>

            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                onlyFavorites
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Saved Favorites ({user?.favorites.length || 0})
            </button>
          </div>
        </div>

        {/* Interactive Category Segmented Filter Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-stone-200/70 rounded-xl overflow-x-auto mb-8">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-white text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-950'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* 3-Column Product Grid (Strict E-Commerce Card Hierarchy & Zero-Pill Metadata) */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
            <p className="text-base font-semibold text-stone-800">No dishes match your current filter</p>
            <p className="text-sm text-stone-500 mt-1 mb-4">
              Try clearing your search query or switching to All Categories.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setOnlyFavorites(false);
                setOnlyFeatured(false);
              }}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
            >
              Reset Menu Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => {
              const isFav = Boolean(user?.favorites.includes(product.id));
              return (
                <article
                  key={product.id}
                  className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    {/* Product Image (65-75% visual dominance) */}
                    <div
                      onClick={() => openProductModal(product)}
                      className="relative aspect-4/3 w-full bg-stone-900 overflow-hidden cursor-pointer"
                    >
                      <SafeFoodImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        aria-label="Save to favorites"
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                      >
                        <Heart
                          className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-white'}`}
                        />
                      </button>
                    </div>

                    {/* Clean Unboxed Metadata & Title */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                        <span className="uppercase tracking-wider font-medium text-stone-500">
                          {product.categoryName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{product.prepTimeMinutes} min</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-amber-700 font-medium">
                          ★ {product.rating.toFixed(1)} ({product.reviewCount})
                        </span>
                      </div>

                      <h3
                        onClick={() => openProductModal(product)}
                        className="text-base font-semibold text-stone-900 hover:text-amber-700 cursor-pointer leading-snug"
                      >
                        {product.name}
                      </h3>

                      <p className="text-xs text-stone-600 mt-2 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Price Baseline & Action Row */}
                  <div className="px-5 pb-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-stone-400 block">Starting from</span>
                      <span className="text-base font-mono font-semibold tabular-nums text-stone-900">
                        ${product.basePrice.toFixed(2)}
                      </span>
                    </div>

                    {product.isAvailable ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openProductModal(product)}
                          className="px-4 py-2 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Customize &amp; Add
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-red-600">Currently Sold Out</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: Active Promotions, Delivery Zones & Verified Customer Reviews */}
      <section id="deals-section" className="bg-white border-t border-stone-200 py-14">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Active Promotional Coupons & Delivery Zones */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h3 className="text-xl font-display font-bold text-stone-900">
                Active Promotions &amp; Delivery Zones
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Click any promo code to copy it directly into your checkout bag.
              </p>
            </div>

            <div className="space-y-3">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-mono font-bold text-sm text-amber-700">{c.code}</p>
                    <p className="text-xs text-stone-600 mt-0.5">{c.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setCouponInput(c.code);
                      setIsCartOpen(true);
                      pushNotification('Promo Selected', `Code ${c.code} ready in checkout drawer.`);
                    }}
                    className="px-3 py-1.5 bg-white border border-stone-300 hover:border-stone-900 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                  >
                    Use Code
                  </button>
                </div>
              ))}
            </div>

            <div id="delivery-section" className="pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                Configured Delivery Coverage Zones
              </h4>
              <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl bg-white">
                {settings?.deliveryZones.map((z) => (
                  <div key={z.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-stone-900">{z.name}</p>
                      <p className="text-stone-500 mt-0.5">
                        Min. Order ${z.minOrder.toFixed(2)} · Est. {z.estimatedMinutes} mins
                      </p>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-stone-800">
                      ${z.fee.toFixed(2)} fee
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attributable Customer Reviews */}
          <div id="reviews-section" className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-bold text-stone-900">
                  Verified Guest Reviews
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Real feedback from customers ordering online and dining in.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.slice(0, 4).map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-xl border border-stone-200 bg-stone-50/60 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span className="font-semibold text-stone-900">{rev.customerName}</span>
                      <span className="font-mono text-amber-700 font-semibold">
                        {'★'.repeat(rev.rating)} ({rev.rating}.0)
                      </span>
                    </div>
                    <p className="text-xs font-medium text-amber-800">{rev.productName}</p>
                    <p className="text-xs text-stone-600 leading-relaxed">“{rev.comment}”</p>
                  </div>
                  <p className="text-[11px] text-stone-400 font-mono tabular-nums">
                    Verified Order · {new Date(rev.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          MODAL 1: Contiguous Product Customization & Reviews Modal
         ======================================================================== */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
            <div className="grid grid-cols-1 md:grid-cols-12">
              {/* Left Column: Sticky Image & Ingredients */}
              <div className="md:col-span-5 bg-stone-950 text-white p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="aspect-4/3 rounded-xl overflow-hidden bg-stone-900">
                    <SafeFoodImage
                      src={activeProduct.image}
                      alt={activeProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-xs text-stone-400 flex items-center gap-2">
                    <span>{activeProduct.categoryName}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{activeProduct.prepTimeMinutes} min prep</span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-white">{activeProduct.name}</h3>
                  <p className="text-xs text-stone-300 leading-relaxed">{activeProduct.description}</p>
                </div>

                {activeProduct.ingredientsList.length > 0 && (
                  <div className="pt-6 border-t border-stone-800 mt-6">
                    <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1.5">
                      Key Ingredients
                    </p>
                    <p className="text-xs text-stone-300">
                      {activeProduct.ingredientsList.join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Contiguous Customization Controls */}
              <div className="md:col-span-7 p-6 flex flex-col justify-between max-h-[82vh] overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                    <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setModalTab('customize')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          modalTab === 'customize'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Customize Dish
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalTab('reviews')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          modalTab === 'reviews'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Reviews ({reviews.filter((r) => r.productId === activeProduct.id).length})
                      </button>
                    </div>
                    <button
                      onClick={() => setActiveProduct(null)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {modalTab === 'customize' ? (
                    <div className="space-y-5 py-4">
                      {/* 1. Size Selection */}
                      {activeProduct.sizes.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                            1. Select Size
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {activeProduct.sizes.map((sz) => {
                              const active = selectedSize?.name === sz.name;
                              return (
                                <button
                                  key={sz.name}
                                  type="button"
                                  onClick={() => setSelectedSize(sz)}
                                  className={`p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors ${
                                    active
                                      ? 'border-amber-600 bg-amber-50/50 text-stone-900 font-semibold'
                                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                                  }`}
                                >
                                  <span className="truncate pr-2">{sz.name}</span>
                                  <span className="font-mono tabular-nums text-stone-600 shrink-0">
                                    {sz.price > 0 ? `+$${sz.price.toFixed(2)}` : 'Base'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Crust / Bread Selection */}
                      {activeProduct.crusts.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                            2. Select Crust / Preparation
                          </label>
                          <div className="space-y-2">
                            {activeProduct.crusts.map((cr) => {
                              const active = selectedCrust?.name === cr.name;
                              return (
                                <button
                                  key={cr.name}
                                  type="button"
                                  onClick={() => setSelectedCrust(cr)}
                                  className={`w-full p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors ${
                                    active
                                      ? 'border-amber-600 bg-amber-50/50 text-stone-900 font-semibold'
                                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                                  }`}
                                >
                                  <span>{cr.name}</span>
                                  <span className="font-mono tabular-nums text-stone-600">
                                    {cr.price > 0 ? `+$${cr.price.toFixed(2)}` : 'Included'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 3. Extra Toppings */}
                      {activeProduct.toppings.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                            3. Extra Toppings (Optional)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeProduct.toppings.map((tp) => {
                              const checked = selectedToppings.some((t) => t.name === tp.name);
                              return (
                                <button
                                  key={tp.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedToppings((prev) =>
                                      checked ? prev.filter((t) => t.name !== tp.name) : [...prev, tp]
                                    );
                                  }}
                                  className={`p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors ${
                                    checked
                                      ? 'border-stone-900 bg-stone-900 text-white font-medium'
                                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                                  }`}
                                >
                                  <span className="truncate pr-2">{tp.name}</span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    +${tp.price.toFixed(2)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 4. Savory Add-Ons */}
                      {activeProduct.addOns.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                            4. Dips, Sides &amp; Drinks (Optional)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeProduct.addOns.map((ao) => {
                              const checked = selectedAddOns.some((a) => a.name === ao.name);
                              return (
                                <button
                                  key={ao.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAddOns((prev) =>
                                      checked ? prev.filter((a) => a.name !== ao.name) : [...prev, ao]
                                    );
                                  }}
                                  className={`p-2.5 rounded-lg border text-left text-xs flex items-center justify-between transition-colors ${
                                    checked
                                      ? 'border-stone-900 bg-stone-900 text-white font-medium'
                                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                                  }`}
                                >
                                  <span className="truncate pr-2">{ao.name}</span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    +${ao.price.toFixed(2)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 5. Special Kitchen Instructions */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                          5. Special Kitchen Instructions
                        </label>
                        <input
                          type="text"
                          value={specialInstructions}
                          onChange={(e) => setSpecialInstructions(e.target.value)}
                          placeholder="e.g., Well-done crust, no onions, sauce on the side..."
                          className="w-full px-3.5 py-2 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-600"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Product Reviews & Write Review Tab */
                    <div className="py-4 space-y-5">
                      <form onSubmit={handleSubmitReview} className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                        <p className="text-xs font-semibold text-stone-800">Write a Customer Review</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-600">Rating:</span>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setReviewRating(num)}
                              className={`p-1 ${
                                num <= reviewRating ? 'text-amber-500' : 'text-stone-300'
                              }`}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Share your thoughts on flavor, portion size, and freshness..."
                          className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
                        >
                          {submittingReview ? 'Submitting...' : 'Post Verified Review'}
                        </button>
                      </form>

                      <div className="space-y-3">
                        {reviews
                          .filter((r) => r.productId === activeProduct.id)
                          .map((r) => (
                            <div key={r.id} className="p-3.5 border border-stone-200 rounded-xl text-xs space-y-1">
                              <div className="flex justify-between font-semibold">
                                <span>{r.customerName}</span>
                                <span className="font-mono text-amber-700">{'★'.repeat(r.rating)}</span>
                              </div>
                              <p className="text-stone-600">{r.comment}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Purchase Footer */}
                <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-4">
                  <div className="flex items-center border border-stone-300 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                      className="p-2.5 text-stone-600 hover:text-stone-950"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-sm font-mono font-semibold tabular-nums">{customQty}</span>
                    <button
                      type="button"
                      onClick={() => setCustomQty((q) => q + 1)}
                      className="p-2.5 text-stone-600 hover:text-stone-950"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      addToCart({
                        product: activeProduct,
                        quantity: customQty,
                        selectedSize,
                        selectedCrust,
                        selectedToppings,
                        selectedAddOns,
                        specialInstructions,
                      });
                      setActiveProduct(null);
                    }}
                    className="flex-1 py-3 px-5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-lg flex items-center justify-between transition-colors"
                  >
                    <span>Add to Order Bag</span>
                    <span className="font-mono tabular-nums">
                      ${(customUnitPrice * customQty).toFixed(2)}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          DRAWER 2: Slide-Over Shopping Cart & Checkout Drawer
         ======================================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col justify-between shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-950 text-white">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-display font-bold">Your Order Bag &amp; Checkout</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
                  <p className="text-base font-semibold text-stone-800">Your order bag is empty</p>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Explore our wood-fired pizzas, smashed burgers, and family deals to start your order.
                  </p>
                </div>
              ) : (
                <>
                  {/* Order Mode Selector: Delivery, Takeaway, Dine-in */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                      Fulfillment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-xl">
                      {(
                        [
                          { id: 'delivery', label: 'Delivery', icon: Truck },
                          { id: 'takeaway', label: 'Takeaway', icon: PackageCheck },
                          { id: 'dine-in', label: 'Dine-In', icon: Utensils },
                        ] as const
                      ).map((mode) => {
                        const Icon = mode.icon;
                        const active = orderType === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setOrderType(mode.id)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                              active
                                ? 'bg-white text-stone-950 shadow-xs'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Itemized Cart List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Selected Items ({cart.reduce((s, i) => s + i.quantity, 0)})
                      </span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-xs text-red-600 hover:underline font-medium"
                      >
                        Clear Bag
                      </button>
                    </div>

                    <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl bg-stone-50/50">
                      {cart.map((item) => (
                        <div key={item.cartItemId} className="p-3.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-stone-900">{item.product.name}</p>
                              <div className="text-[11px] text-stone-500 space-y-0.5 mt-0.5">
                                {item.selectedSize && <p>Size: {item.selectedSize.name}</p>}
                                {item.selectedCrust && <p>Crust: {item.selectedCrust.name}</p>}
                                {item.selectedToppings.length > 0 && (
                                  <p>Toppings: {item.selectedToppings.map((t) => t.name).join(', ')}</p>
                                )}
                                {item.selectedAddOns.length > 0 && (
                                  <p>Add-Ons: {item.selectedAddOns.map((a) => a.name).join(', ')}</p>
                                )}
                                {item.specialInstructions && (
                                  <p className="text-amber-800 italic">Note: “{item.specialInstructions}”</p>
                                )}
                              </div>
                            </div>
                            <span className="font-mono text-xs font-semibold tabular-nums text-stone-900">
                              ${item.lineTotal.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="text-[11px] text-stone-400 hover:text-red-600"
                            >
                              Remove
                            </button>
                            <div className="flex items-center border border-stone-300 bg-white rounded-md">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.cartItemId, -1)}
                                className="px-2 py-1 text-stone-600 hover:text-stone-950"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 text-xs font-mono font-semibold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.cartItemId, 1)}
                                className="px-2 py-1 text-stone-600 hover:text-stone-950"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coupon Code Bar */}
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <label className="block text-xs font-semibold text-stone-700">
                      Promotional Coupon Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Enter EMBER20, FEAST10, WELCOME15"
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        className="px-3.5 py-1.5 bg-stone-900 text-white text-xs font-semibold rounded-lg"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                    {appliedCoupon && (
                      <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                        <span>
                          Code <strong>{appliedCoupon.code}</strong> applied (-$
                          {appliedCoupon.discountAmount.toFixed(2)})
                        </span>
                        <button
                          type="button"
                          onClick={() => setAppliedCoupon(null)}
                          className="text-stone-400 hover:text-stone-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Customer & Delivery Details Form */}
                  <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Customer &amp; Fulfillment Details
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-stone-600 mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-600 mb-1">Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {orderType === 'delivery' && (
                      <>
                        {user && user.savedAddresses.length > 0 && (
                          <div>
                            <label className="block text-xs text-stone-600 mb-1">
                              Saved Addresses
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {user.savedAddresses.map((addr) => (
                                <button
                                  key={addr.id}
                                  type="button"
                                  onClick={() => {
                                    setDeliveryAddress(addr.street);
                                    setDeliveryZone(addr.zone);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                                    deliveryAddress === addr.street
                                      ? 'border-amber-600 bg-amber-50 text-stone-900 font-semibold'
                                      : 'border-stone-200 text-stone-600'
                                  }`}
                                >
                                  {addr.label}: {addr.street}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs text-stone-600 mb-1">Delivery Zone *</label>
                          <select
                            value={deliveryZone}
                            onChange={(e) => setDeliveryZone(e.target.value)}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                          >
                            {settings?.deliveryZones.map((z) => (
                              <option key={z.id} value={z.name}>
                                {z.name} — Fee ${z.fee.toFixed(2)} (Min ${z.minOrder})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-stone-600 mb-1">
                            Street Address, Building &amp; Apartment *
                          </label>
                          <input
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Street address, floor, buzzer..."
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                          />
                        </div>
                      </>
                    )}

                    {orderType === 'dine-in' && (
                      <div>
                        <label className="block text-xs text-stone-600 mb-1">Table Number *</label>
                        <input
                          type="text"
                          required
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="e.g. Table 05"
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        Delivery / Kitchen Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Gate code, extra napkins, allergies..."
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                        Payment Method
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'cash', label: 'Cash (COD)' },
                            { id: 'card', label: 'Card' },
                            { id: 'online', label: 'Online Pay' },
                          ] as const
                        ).map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPaymentMethod(pm.id)}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              paymentMethod === pm.id
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Checkout Summary Footer */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-stone-200 bg-stone-50 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">${cartTotals.subtotal.toFixed(2)}</span>
                  </div>
                  {cartTotals.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Promotional Discount ({appliedCoupon?.code})</span>
                      <span className="font-mono tabular-nums">
                        -${cartTotals.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600">
                    <span>Estimated Tax ({settings?.taxRatePercent || 8.5}%)</span>
                    <span className="font-mono tabular-nums">${cartTotals.taxAmount.toFixed(2)}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="flex justify-between text-stone-600">
                      <span>
                        Delivery Fee {cartTotals.subtotal >= 50 ? '(Free over $50)' : ''}
                      </span>
                      <span className="font-mono tabular-nums">
                        {cartTotals.deliveryFee === 0
                          ? 'FREE'
                          : `$${cartTotals.deliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-stone-950 pt-2 border-t border-stone-200">
                    <span>Total Due ({paymentMethod.toUpperCase()})</span>
                    <span className="font-mono tabular-nums">${cartTotals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={placingOrder}
                  className="w-full py-3.5 px-6 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-400 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-between"
                >
                  <span>
                    {placingOrder
                      ? 'Submitting Order to Kitchen...'
                      : `Confirm & Place Order (Est. ${cartTotals.estimatedMinutes} min)`}
                  </span>
                  <span className="font-mono tabular-nums">${cartTotals.totalAmount.toFixed(2)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: Live Real-Time Order Tracker Modal
         ======================================================================== */}
      {liveTrackedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs font-mono uppercase text-amber-700 font-semibold">
                  Real-Time Socket.IO Order Tracker
                </p>
                <h3 className="text-xl font-display font-bold text-stone-900 mt-0.5">
                  Order #{liveTrackedOrder.orderNumber} — {liveTrackedOrder.status}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Customer: {liveTrackedOrder.customerName} · {liveTrackedOrder.orderType.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setTrackedOrder(null)}
                className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 6-Stage Order Pipeline Progress */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered'] as const).map(
                (step, idx, arr) => {
                  const currentIdx = arr.indexOf(liveTrackedOrder.status as typeof step);
                  const completed = currentIdx >= idx;
                  return (
                    <div
                      key={step}
                      className={`p-2.5 rounded-lg border text-center ${
                        completed
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 bg-stone-50 text-stone-400'
                      }`}
                    >
                      <div className="w-5 h-5 mx-auto mb-1 rounded-full flex items-center justify-center text-[11px] font-mono font-bold bg-white border">
                        {completed ? <Check className="w-3 h-3 text-emerald-600" /> : idx + 1}
                      </div>
                      <p className="text-[11px] font-semibold leading-tight">{step}</p>
                    </div>
                  );
                }
              )}
            </div>

            {/* Rider & Delivery Info */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Estimated Time:
                </span>
                <span className="font-mono font-semibold text-stone-900">
                  {liveTrackedOrder.estimatedDeliveryMinutes} mins
                </span>
              </div>
              {liveTrackedOrder.deliveryAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Delivery Address:
                  </span>
                  <span className="font-medium text-stone-900">{liveTrackedOrder.deliveryAddress}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Assigned Delivery Rider:</span>
                <span className="font-semibold text-stone-900">
                  {liveTrackedOrder.assignedRiderName || 'Awaiting Kitchen Ready Dispatch'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Payment Status:</span>
                <span className="font-mono font-semibold text-stone-900">
                  {liveTrackedOrder.paymentMethod.toUpperCase()} · {liveTrackedOrder.paymentStatus}
                </span>
              </div>
            </div>

            {/* Item Summary */}
            <div className="space-y-2 max-h-44 overflow-y-auto border-t border-stone-200 pt-3">
              {liveTrackedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    <strong>{item.quantity}×</strong> {item.productName}{' '}
                    {item.selectedSize ? `(${item.selectedSize.name})` : ''}
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    ${item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-stone-200">
                <span>Total Amount</span>
                <span className="font-mono tabular-nums">${liveTrackedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 4: Customer Order History & 1-Click Reorder
         ======================================================================== */}
      {showOrderHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-lg font-display font-bold text-stone-900">
                  Customer Order History &amp; Instant Reorder
                </h3>
                <p className="text-xs text-stone-500">
                  View live order statuses or restore any past order to your bag in one click.
                </p>
              </div>
              <button
                onClick={() => setShowOrderHistoryModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {customerOrders.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-stone-800">
                    No Orders Found in Your History Yet
                  </p>
                  <p className="text-xs text-stone-500">
                    When you place an order, your personal order history will appear here so you can track it live or reorder in one click.
                  </p>
                </div>
              ) : (
                customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-stone-900">#{ord.orderNumber}</span>
                        <span>·</span>
                        <span className="font-semibold text-amber-700">{ord.status}</span>
                        <span>·</span>
                        <span className="text-stone-500 font-mono tabular-nums">
                          {new Date(ord.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700">
                        {ord.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                      </p>
                      <p className="text-xs font-mono font-semibold text-stone-900">
                        Total: ${ord.totalAmount.toFixed(2)} ({ord.paymentMethod.toUpperCase()} ·{' '}
                        {ord.paymentStatus})
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setShowOrderHistoryModal(false);
                          setTrackedOrder(ord);
                        }}
                        className="px-3 py-1.5 bg-white border border-stone-300 hover:border-stone-900 text-xs font-semibold rounded-lg"
                      >
                        Track Status
                      </button>
                      <button
                        onClick={() => {
                          setShowOrderHistoryModal(false);
                          reorderPastOrder(ord);
                        }}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reorder
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
