import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  IUser,
  ICategory,
  IProduct,
  IOrder,
  IPayment,
  IRefund,
  IInventoryItem,
  ISupplier,
  IStaffMember,
  IExpense,
  ICoupon,
  IReview,
  IRestaurantSettings,
  IAuditLog,
  UserModel,
  CategoryModel,
  ProductModel,
  OrderModel,
  PaymentModel,
  RefundModel,
  InventoryItemModel,
  SupplierModel,
  StaffModel,
  ExpenseModel,
  CouponModel,
  ReviewModel,
  RestaurantSettingsModel,
  AuditLogModel,
} from '../models/schemas.js';
import {
  initialSettings,
  initialUsers,
  initialCategories,
  initialProducts,
  initialInventory,
  initialSuppliers,
  initialStaff,
  initialExpenses,
  initialCoupons,
  initialReviews,
  initialOrders,
  initialPayments,
  initialAuditLogs,
} from './seedData.js';

export interface DatabaseShape {
  dataMode: 'demo' | 'production';
  mongoConnected: boolean;
  settings: IRestaurantSettings;
  users: IUser[];
  categories: ICategory[];
  products: IProduct[];
  orders: IOrder[];
  payments: IPayment[];
  refunds: IRefund[];
  inventory: IInventoryItem[];
  suppliers: ISupplier[];
  staff: IStaffMember[];
  expenses: IExpense[];
  coupons: ICoupon[];
  reviews: IReview[];
  auditLogs: IAuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

class DataStore {
  public state: DatabaseShape;
  public isMongoConnected = false;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw);
      } catch {
        this.state = this.createDefaultState('demo');
        this.saveToDisk();
      }
    } else {
      const mode = process.env.DATA_MODE === 'production' ? 'production' : 'demo';
      this.state = this.createDefaultState(mode);
      this.saveToDisk();
    }
  }

  public createDefaultState(mode: 'demo' | 'production'): DatabaseShape {
    if (mode === 'production') {
      // Production keeps only non-demo core system accounts and restaurant settings
      return {
        dataMode: 'production',
        mongoConnected: this.isMongoConnected,
        settings: { ...initialSettings },
        users: initialUsers.filter((u) => !u.isDemo),
        categories: [...initialCategories.map((c) => ({ ...c, isDemo: false }))],
        products: [],
        orders: [],
        payments: [],
        refunds: [],
        inventory: [],
        suppliers: [],
        staff: [],
        expenses: [],
        coupons: [],
        reviews: [],
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            action: 'PRODUCTION_MODE_INITIALIZED',
            actorName: 'System',
            actorRole: 'owner',
            details: 'Initialized clean production database without sample demo records.',
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    return {
      dataMode: 'demo',
      mongoConnected: this.isMongoConnected,
      settings: JSON.parse(JSON.stringify(initialSettings)),
      users: JSON.parse(JSON.stringify(initialUsers)),
      categories: JSON.parse(JSON.stringify(initialCategories)),
      products: JSON.parse(JSON.stringify(initialProducts)),
      orders: JSON.parse(JSON.stringify(initialOrders)),
      payments: JSON.parse(JSON.stringify(initialPayments)),
      refunds: [],
      inventory: JSON.parse(JSON.stringify(initialInventory)),
      suppliers: JSON.parse(JSON.stringify(initialSuppliers)),
      staff: JSON.parse(JSON.stringify(initialStaff)),
      expenses: JSON.parse(JSON.stringify(initialExpenses)),
      coupons: JSON.parse(JSON.stringify(initialCoupons)),
      reviews: JSON.parse(JSON.stringify(initialReviews)),
      auditLogs: JSON.parse(JSON.stringify(initialAuditLogs)),
    };
  }

  public async connectMongo(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (uri && uri.startsWith('mongodb') && !uri.includes('<username>')) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
        this.isMongoConnected = true;
        this.state.mongoConnected = true;
        console.log('Connected to MongoDB Atlas via Mongoose');
        await this.syncToMongoIfEmpty();
      } catch (err) {
        console.warn('MongoDB URI unreachable; using embedded Mongoose-validated datastore:', (err as Error).message);
        this.isMongoConnected = false;
        this.state.mongoConnected = false;
      }
    }
  }

  private async syncToMongoIfEmpty(): Promise<void> {
    if (!this.isMongoConnected) return;
    const count = await ProductModel.countDocuments();
    if (count === 0 && this.state.products.length > 0) {
      await RestaurantSettingsModel.deleteMany({});
      await RestaurantSettingsModel.create(this.state.settings);
      await UserModel.insertMany(this.state.users, { ordered: false }).catch(() => {});
      await CategoryModel.insertMany(this.state.categories, { ordered: false }).catch(() => {});
      await ProductModel.insertMany(this.state.products, { ordered: false }).catch(() => {});
      await InventoryItemModel.insertMany(this.state.inventory, { ordered: false }).catch(() => {});
      await SupplierModel.insertMany(this.state.suppliers, { ordered: false }).catch(() => {});
      await StaffModel.insertMany(this.state.staff, { ordered: false }).catch(() => {});
      await ExpenseModel.insertMany(this.state.expenses, { ordered: false }).catch(() => {});
      await CouponModel.insertMany(this.state.coupons, { ordered: false }).catch(() => {});
      await ReviewModel.insertMany(this.state.reviews, { ordered: false }).catch(() => {});
      await OrderModel.insertMany(this.state.orders, { ordered: false }).catch(() => {});
      await PaymentModel.insertMany(this.state.payments, { ordered: false }).catch(() => {});
      await AuditLogModel.insertMany(this.state.auditLogs, { ordered: false }).catch(() => {});
    }
  }

  public saveToDisk(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving datastore to disk:', err);
    }
  }

  public logAudit(action: string, actorName: string, actorRole: string, details: string): void {
    const entry: IAuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      actorName,
      actorRole,
      details,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > 250) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 250);
    }
    if (this.isMongoConnected) {
      AuditLogModel.create(entry).catch(() => {});
    }
    this.saveToDisk();
  }

  public switchDataMode(mode: 'demo' | 'production', actorName: string): void {
    this.state = this.createDefaultState(mode);
    this.logAudit(
      `DATA_MODE_SWITCHED_TO_${mode.toUpperCase()}`,
      actorName,
      'owner',
      `Database reset to ${mode} dataset.`
    );
    this.saveToDisk();
  }
}

export const db = new DataStore();
