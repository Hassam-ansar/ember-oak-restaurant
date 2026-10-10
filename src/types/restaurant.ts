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
  role: UserRole;
  loyaltyPoints: number;
  favorites: string[];
  savedAddresses: IAddress[];
  isActive: boolean;
  isDemo?: boolean;
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface IProductOption {
  name: string;
  price: number;
}

export interface IProductRecipeIngredient {
  inventoryItemId: string;
  ingredientName: string;
  quantityPerUnit: number;
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
  sizes: IProductOption[];
  crusts: IProductOption[];
  toppings: IProductOption[];
  addOns: IProductOption[];
  ingredientsList: string[];
  recipe: IProductRecipeIngredient[];
  prepTimeMinutes: number;
  isAvailable: boolean;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  totalSold: number;
}

export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitBasePrice: number;
  selectedSize?: IProductOption;
  selectedCrust?: IProductOption;
  selectedToppings: IProductOption[];
  selectedAddOns: IProductOption[];
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
  estimatedCost: number;
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

export interface IInventoryItem {
  id: string;
  name: string;
  category: 'Flour & Dough' | 'Cheese & Dairy' | 'Meats & Poultry' | 'Sauces & Oils' | 'Vegetables' | 'Packaging';
  currentStock: number;
  unit: string;
  minStockLevel: number;
  costPerUnit: number;
  supplierId?: string;
  supplierName?: string;
  expiryDate: string;
  wastageLogged: number;
  lastRestockedAt: string;
}

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
}

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
}

export interface IExpense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paidTo: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  recordedBy: string;
}

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
}

export interface IReview {
  id: string;
  productId: string;
  productName: string;
  customerId?: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

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

export interface CartItem {
  cartItemId: string;
  product: IProduct;
  quantity: number;
  selectedSize?: IProductOption;
  selectedCrust?: IProductOption;
  selectedToppings: IProductOption[];
  selectedAddOns: IProductOption[];
  specialInstructions?: string;
  unitPrice: number;
  lineTotal: number;
}
