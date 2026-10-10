import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'rider' | 'customer';

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type OrderType = 'delivery' | 'takeaway' | 'dine-in' | 'pos-walkin' | 'pos-phone';
export type PaymentMethod = 'cash' | 'card' | 'online';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded' | 'Failed';

// 1. User Schema
export interface IAddress {
  id: string;
  label: string;
  street: string;
  zone: string;
  city: string;
  phone: string;
  isDefault?: boolean;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  loyaltyPoints: number;
  favorites: string[]; // product IDs
  savedAddresses: IAddress[];
  isActive: boolean;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['owner', 'manager', 'cashier', 'kitchen', 'rider', 'customer'],
      default: 'customer',
      index: true,
    },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    favorites: [{ type: String }],
    savedAddresses: [
      {
        id: String,
        label: String,
        street: String,
        zone: String,
        city: String,
        phone: String,
        isDefault: Boolean,
      },
    ],
    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 2. Category Schema
export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isDemo?: boolean;
}

const CategorySchema = new Schema<ICategory>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 3. Product Schema
export interface IProductOption {
  name: string;
  price: number; // delta or override
}

export interface IProductRecipeIngredient {
  inventoryItemId: string;
  ingredientName: string;
  quantityPerUnit: number; // e.g. 0.25 kg flour
  unit: string;
}

export interface IProduct {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  image: string;
  basePrice: number;
  sizes: IProductOption[]; // e.g. Small +0, Medium +4, Large +8, Family +12
  crusts: IProductOption[]; // e.g. Classic Hand-Tossed +0, Crown Crust +3.5, Cheese Burst +4
  toppings: IProductOption[]; // e.g. Extra Mozzarella +2, Smoked Pepperoni +2.5, Jalapenos +1
  addOns: IProductOption[]; // e.g. Garlic Herb Dip +1.5, Regular Fries +3, Soft Drink +2
  ingredientsList: string[];
  recipe: IProductRecipeIngredient[];
  prepTimeMinutes: number;
  isAvailable: boolean;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  totalSold: number;
  isDemo?: boolean;
  createdAt: string;
}

const ProductSchema = new Schema<IProduct>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    categoryId: { type: String, required: true, index: true },
    categoryName: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    basePrice: { type: Number, required: true, min: 0 },
    sizes: [{ name: String, price: Number }],
    crusts: [{ name: String, price: Number }],
    toppings: [{ name: String, price: Number }],
    addOns: [{ name: String, price: Number }],
    ingredientsList: [{ type: String }],
    recipe: [
      {
        inventoryItemId: String,
        ingredientName: String,
        quantityPerUnit: Number,
        unit: String,
      },
    ],
    prepTimeMinutes: { type: Number, default: 15 },
    isAvailable: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 4. Order Schema
export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitBasePrice: number;
  selectedSize?: { name: string; price: number };
  selectedCrust?: { name: string; price: number };
  selectedToppings: { name: string; price: number }[];
  selectedAddOns: { name: string; price: number }[];
  specialInstructions?: string;
  itemUnitTotal: number;
  lineTotal: number;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  deliveryZone?: string;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string;
  totalAmount: number;
  estimatedCost: number; // Calculated ingredient COGS
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  orderNotes?: string;
  assignedRiderId?: string;
  assignedRiderName?: string;
  cashCollected: boolean;
  estimatedDeliveryMinutes: number;
  prepStartedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  inventoryDeducted: boolean;
  statusHistory: { status: OrderStatus; timestamp: string; updatedBy: string }[];
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

const OrderSchema = new Schema<IOrder>(
  {
    id: { type: String, required: true, unique: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },
    orderType: {
      type: String,
      enum: ['delivery', 'takeaway', 'dine-in', 'pos-walkin', 'pos-phone'],
      required: true,
      index: true,
    },
    tableNumber: { type: String },
    deliveryAddress: { type: String },
    deliveryZone: { type: String },
    items: [
      {
        productId: String,
        productName: String,
        quantity: Number,
        unitBasePrice: Number,
        selectedSize: { name: String, price: Number },
        selectedCrust: { name: String, price: Number },
        selectedToppings: [{ name: String, price: Number }],
        selectedAddOns: [{ name: String, price: Number }],
        specialInstructions: String,
        itemUnitTotal: Number,
        lineTotal: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode: { type: String },
    totalAmount: { type: Number, required: true },
    estimatedCost: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'online'], required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded', 'Failed'], default: 'Pending' },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    orderNotes: { type: String },
    assignedRiderId: { type: String, index: true },
    assignedRiderName: { type: String },
    cashCollected: { type: Boolean, default: false },
    estimatedDeliveryMinutes: { type: Number, default: 35 },
    prepStartedAt: { type: String },
    readyAt: { type: String },
    deliveredAt: { type: String },
    inventoryDeducted: { type: Boolean, default: false },
    statusHistory: [{ status: String, timestamp: String, updatedBy: String }],
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 5. Payment & 6. Refund Schemas
export interface IPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;
  processedBy: string;
  createdAt: string;
}

const PaymentSchema = new Schema<IPayment>(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'card', 'online'], required: true },
    status: { type: String, enum: ['Pending', 'Paid', 'Refunded', 'Failed'], required: true },
    transactionRef: { type: String },
    processedBy: { type: String },
  },
  { timestamps: true }
);

export interface IRefund {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  reason: string;
  approvedBy: string;
  createdAt: string;
}

const RefundSchema = new Schema<IRefund>(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    approvedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// 7. Inventory & 8. Recipe & 9. Supplier Schemas
export interface IInventoryItem {
  id: string;
  name: string;
  category: 'Flour & Dough' | 'Cheese & Dairy' | 'Meats & Poultry' | 'Sauces & Oils' | 'Vegetables' | 'Packaging';
  currentStock: number;
  unit: string; // kg, L, pcs
  minStockLevel: number;
  costPerUnit: number;
  supplierId?: string;
  supplierName?: string;
  expiryDate: string;
  wastageLogged: number;
  lastRestockedAt: string;
  isDemo?: boolean;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Flour & Dough', 'Cheese & Dairy', 'Meats & Poultry', 'Sauces & Oils', 'Vegetables', 'Packaging'],
      required: true,
    },
    currentStock: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    minStockLevel: { type: Number, required: true, min: 0 },
    costPerUnit: { type: Number, required: true, min: 0 },
    supplierId: { type: String },
    supplierName: { type: String },
    expiryDate: { type: String, required: true },
    wastageLogged: { type: Number, default: 0 },
    lastRestockedAt: { type: String },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export interface ISupplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  itemsSupplied: string[];
  totalPurchasesAmount: number;
  balanceDue: number;
  lastSupplyDate: string;
  isDemo?: boolean;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contactPerson: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    itemsSupplied: [{ type: String }],
    totalPurchasesAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    lastSupplyDate: { type: String },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 10. Staff Schema
export interface IStaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  salaryMonthly: number;
  shift: 'Morning (09:00 - 17:00)' | 'Evening (16:00 - 00:00)' | 'Full Day';
  attendanceToday: 'Present' | 'Absent' | 'On Leave';
  daysPresentThisMonth: number;
  status: 'Active' | 'On Leave' | 'Inactive';
  joinedDate: string;
  isDemo?: boolean;
}

const StaffSchema = new Schema<IStaffMember>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, required: true },
    salaryMonthly: { type: Number, required: true },
    shift: { type: String, default: 'Morning (09:00 - 17:00)' },
    attendanceToday: { type: String, enum: ['Present', 'Absent', 'On Leave'], default: 'Present' },
    daysPresentThisMonth: { type: Number, default: 22 },
    status: { type: String, enum: ['Active', 'On Leave', 'Inactive'], default: 'Active' },
    joinedDate: { type: String, required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 11. Expense Schema
export interface IExpense {
  id: string;
  title: string;
  category: 'Ingredient Purchase' | 'Salaries & Payroll' | 'Rent' | 'Utilities (Electricity/Gas)' | 'Packaging & Supplies' | 'Marketing & Promo' | 'Maintenance';
  amount: number;
  date: string;
  paidTo: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  recordedBy: string;
  isDemo?: boolean;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true, index: true },
    paidTo: { type: String, required: true },
    paymentMethod: { type: String, default: 'cash' },
    notes: { type: String },
    recordedBy: { type: String, required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 12. Coupon Schema
export interface ICoupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  usageCount: number;
  usageLimit: number;
  expiresAt: string;
  isActive: boolean;
  isDemo?: boolean;
}

const CouponSchema = new Schema<ICoupon>(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    description: { type: String, required: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 500 },
    expiresAt: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 13. Review Schema
export interface IReview {
  id: string;
  productId: string;
  productName: string;
  customerId?: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  isDemo?: boolean;
}

const ReviewSchema = new Schema<IReview>(
  {
    id: { type: String, required: true, unique: true },
    productId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    customerId: { type: String },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 14. Restaurant Settings & Delivery Zones Schema
export interface IDeliveryZone {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  estimatedMinutes: number;
}

export interface IRestaurantSettings {
  id: string;
  restaurantName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  taxRatePercent: number;
  loyaltyPointsPerDollar: number;
  isAcceptingOrders: boolean;
  promotionalBannerText: string;
  deliveryZones: IDeliveryZone[];
}

const RestaurantSettingsSchema = new Schema<IRestaurantSettings>(
  {
    id: { type: String, required: true, unique: true },
    restaurantName: { type: String, required: true },
    tagline: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    currency: { type: String, default: '$' },
    taxRatePercent: { type: Number, default: 8.5 },
    loyaltyPointsPerDollar: { type: Number, default: 10 },
    isAcceptingOrders: { type: Boolean, default: true },
    promotionalBannerText: { type: String },
    deliveryZones: [
      {
        id: String,
        name: String,
        fee: Number,
        minOrder: Number,
        estimatedMinutes: Number,
      },
    ],
  },
  { timestamps: true }
);

// 15. Audit Log Schema
export interface IAuditLog {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  details: string;
  timestamp: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    id: { type: String, required: true, unique: true },
    action: { type: String, required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    details: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const CategoryModel = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
export const ProductModel = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
export const OrderModel = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
export const PaymentModel = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
export const RefundModel = mongoose.models.Refund || mongoose.model<IRefund>('Refund', RefundSchema);
export const InventoryItemModel = mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
export const SupplierModel = mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);
export const StaffModel = mongoose.models.Staff || mongoose.model<IStaffMember>('Staff', StaffSchema);
export const ExpenseModel = mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);
export const CouponModel = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);
export const ReviewModel = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);
export const RestaurantSettingsModel = mongoose.models.RestaurantSettings || mongoose.model<IRestaurantSettings>('RestaurantSettings', RestaurantSettingsSchema);
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
