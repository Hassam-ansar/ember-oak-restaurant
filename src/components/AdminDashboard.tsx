import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  BarChart3,
  UtensilsCrossed,
  Package,
  Users,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Settings,
  X,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  IProduct,
  IInventoryItem,
  IStaffMember,
  IExpense,
  ICoupon,
  ISupplier,
  UserRole,
} from '../types/restaurant';
import { exportAnalyticsToPDF, exportAnalyticsToExcel } from '../utils/exportReports';
import { SafeFoodImage } from './SafeFoodImage';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PRESET_IMAGES = [
  { label: 'Supreme & Crown Crust Pizza', url: '/src/assets/images/food_pizza_crown_crust_1791612750318.jpg' },
  { label: 'Double Smash & Zinger Burger', url: '/src/assets/images/food_burger_double_smash_1791612760067.jpg' },
  { label: 'Shawarma Wraps & Club Sandwich', url: '/src/assets/images/food_shawarma_wraps_1791612772317.jpg' },
  { label: 'Crispy Fried Chicken & Hot Wings', url: '/src/assets/images/food_fried_chicken_wings_1791612782948.jpg' },
  { label: 'Fettuccine Pasta & Lava Cake', url: '/src/assets/images/food_pasta_dessert_drinks_1791612793526.jpg' },
  { label: 'Grand Feast Platter', url: '/src/assets/images/hero_artisan_pizza_feast_1791612739930.jpg' },
];

export const AdminDashboard: React.FC = () => {
  const {
    dataMode,
    settings,
    categories,
    products,
    orders,
    inventory,
    suppliers,
    coupons,
    user,
    apiFetch,
    pushNotification,
    refreshAll,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<'analytics' | 'menu' | 'inventory' | 'business' | 'customers'>('analytics');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [excludeDemo, setExcludeDemo] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<{
    metrics: {
      totalRevenue: number;
      totalOrders: number;
      cancelledOrdersCount: number;
      avgOrderValue: number;
      totalIngredientCOGS: number;
      grossProfit: number;
      totalOperatingExpenses: number;
      netProfit: number;
      pendingDeliveries: number;
      lowStockCount: number;
    };
    bestsellingProducts: { id: string; name: string; category: string; unitsSold: number; revenue: number }[];
    chartData: { labels: string[]; revenueSeries: number[]; ordersSeries: number[] };
    expenses: IExpense[];
  } | null>(null);

  // Management State (Staff, Expenses, Customers CRM, Audit Logs)
  const [staffList, setStaffList] = useState<IStaffMember[]>([]);
  const [expenseList, setExpenseList] = useState<IExpense[]>([]);
  const [customerList, setCustomerList] = useState<
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
    }[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<
    { id: string; action: string; actorName: string; actorRole: string; details: string; timestamp: string }[]
  >([]);

  // Menu Management State
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Partial<IProduct> | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // Inventory Adjust Modal State
  const [adjustingItem, setAdjustingItem] = useState<IInventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'restock' | 'wastage'>('restock');
  const [adjustQty, setAdjustQty] = useState<string>('10');
  const [recordPurchaseExpense, setRecordPurchaseExpense] = useState<boolean>(true);

  // New Ingredient Form State
  const [newIngName, setNewIngName] = useState<string>('');
  const [newIngCategory, setNewIngCategory] = useState<IInventoryItem['category']>('Flour & Dough');
  const [newIngStock, setNewIngStock] = useState<string>('25');
  const [newIngUnit, setNewIngUnit] = useState<string>('kg');
  const [newIngMin, setNewIngMin] = useState<string>('10');
  const [newIngCost, setNewIngCost] = useState<string>('3.50');

  // New Staff, Expense & Coupon Forms
  const [staffName, setStaffName] = useState<string>('');
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffRole, setStaffRole] = useState<UserRole>('cashier');
  const [staffSalary, setStaffSalary] = useState<string>('3200');

  const [expTitle, setExpTitle] = useState<string>('');
  const [expCategory, setExpCategory] = useState<string>('Ingredient Purchase');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expVendor, setExpVendor] = useState<string>('');

  const [couponCode, setCouponCode] = useState<string>('');
  const [couponDesc, setCouponDesc] = useState<string>('');
  const [couponType, setCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponVal, setCouponVal] = useState<string>('15');
  const [couponMin, setCouponMin] = useState<string>('25');

  // Supplier Form
  const [supName, setSupName] = useState<string>('');
  const [supContact, setSupContact] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');

  const fetchAdminData = useCallback(async () => {
    try {
      const [ana, mgmt] = await Promise.all([
        apiFetch<typeof analyticsData>(
          `/api/analytics?period=${period}&excludeDemo=${excludeDemo}`
        ),
        apiFetch<{
          staff: IStaffMember[];
          expenses: IExpense[];
          coupons: ICoupon[];
          suppliers: ISupplier[];
          customers: typeof customerList;
          auditLogs: typeof auditLogs;
        }>('/api/management'),
      ]);
      setAnalyticsData(ana);
      setStaffList(mgmt.staff);
      setExpenseList(mgmt.expenses);
      setCustomerList(mgmt.customers || []);
      setAuditLogs(mgmt.auditLogs);
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
    }
  }, [apiFetch, period, excludeDemo]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData, orders, inventory, products]);

  // Handlers: Product Save
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || !editingProduct.categoryId) return;
    try {
      if (editingProduct.id) {
        await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingProduct),
        });
        pushNotification('Product Updated', `Saved changes to ${editingProduct.name}`);
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(editingProduct),
        });
        pushNotification('Product Created', `Added ${editingProduct.name} to menu`);
      }
      setEditingProduct(null);
      refreshAll();
    } catch (err) {
      pushNotification('Menu Error', (err as Error).message);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      pushNotification('Product Deleted', `Removed ${name}`);
      refreshAll();
    } catch (err) {
      pushNotification('Delete Error', (err as Error).message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName }),
      });
      setNewCategoryName('');
      pushNotification('Category Added', `Created category '${newCategoryName}'`);
      refreshAll();
    } catch (err) {
      pushNotification('Category Error', (err as Error).message);
    }
  };

  // Handlers: Inventory Adjust & Add
  const handleConfirmInventoryAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    try {
      await apiFetch(`/api/inventory/${adjustingItem.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          type: adjustType,
          quantity: Number(adjustQty),
          recordPurchaseExpense: adjustType === 'restock' && recordPurchaseExpense,
        }),
      });
      pushNotification(
        'Inventory Updated',
        `${adjustType === 'restock' ? 'Restocked' : 'Logged wastage for'} ${adjustingItem.name}`
      );
      setAdjustingItem(null);
      refreshAll();
      fetchAdminData();
    } catch (err) {
      pushNotification('Inventory Error', (err as Error).message);
    }
  };

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;
    try {
      await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: newIngName,
          category: newIngCategory,
          currentStock: Number(newIngStock),
          unit: newIngUnit,
          minStockLevel: Number(newIngMin),
          costPerUnit: Number(newIngCost),
        }),
      });
      setNewIngName('');
      pushNotification('Ingredient Added', `Added ${newIngName} to inventory`);
      refreshAll();
    } catch (err) {
      pushNotification('Inventory Error', (err as Error).message);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim()) return;
    try {
      await apiFetch('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: supName,
          contactPerson: supContact || 'Account Lead',
          phone: supPhone,
        }),
      });
      setSupName('');
      setSupContact('');
      setSupPhone('');
      pushNotification('Supplier Added', `Added supplier ${supName}`);
      refreshAll();
    } catch (err) {
      pushNotification('Supplier Error', (err as Error).message);
    }
  };

  // Handlers: Staff, Expense, Coupon, Data Mode
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;
    try {
      await apiFetch('/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          role: staffRole,
          salaryMonthly: Number(staffSalary),
        }),
      });
      setStaffName('');
      setStaffEmail('');
      pushNotification('Staff Added', `Added ${staffName} to payroll`);
      fetchAdminData();
    } catch (err) {
      pushNotification('Staff Error', (err as Error).message);
    }
  };

  const handleToggleAttendance = async (member: IStaffMember) => {
    const nextOrder: IStaffMember['attendanceToday'][] = ['Present', 'Absent', 'On Leave'];
    const next =
      nextOrder[(nextOrder.indexOf(member.attendanceToday) + 1) % nextOrder.length];
    try {
      await apiFetch(`/api/staff/${member.id}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ attendanceToday: next }),
      });
      fetchAdminData();
    } catch (err) {
      pushNotification('Attendance Error', (err as Error).message);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: expTitle,
          category: expCategory,
          amount: Number(expAmount),
          paidTo: expVendor || 'Vendor',
        }),
      });
      setExpTitle('');
      setExpAmount('');
      setExpVendor('');
      pushNotification('Expense Logged', `Recorded $${Number(expAmount).toFixed(2)} expense`);
      fetchAdminData();
    } catch (err) {
      pushNotification('Expense Error', (err as Error).message);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    try {
      await apiFetch('/api/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode,
          description: couponDesc || `${couponVal}${couponType === 'percentage' ? '%' : '$'} Off Order`,
          discountType: couponType,
          discountValue: Number(couponVal),
          minOrderAmount: Number(couponMin),
        }),
      });
      setCouponCode('');
      setCouponDesc('');
      pushNotification('Coupon Created', `Promo code ${couponCode.toUpperCase()} is now live.`);
      refreshAll();
    } catch (err) {
      pushNotification('Coupon Error', (err as Error).message);
    }
  };

  const handleSwitchDataMode = async (mode: 'demo' | 'production') => {
    try {
      await apiFetch('/api/admin/data-mode', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      pushNotification(
        `Switched to ${mode.toUpperCase()} Mode`,
        mode === 'production'
          ? 'Purged sample demo records for clean production deployment.'
          : 'Restored sample demo products, inventory, and orders.'
      );
      await refreshAll();
      await fetchAdminData();
    } catch (err) {
      pushNotification('Permission Required', (err as Error).message);
    }
  };

  const metrics = analyticsData?.metrics || {
    totalRevenue: 0,
    totalOrders: 0,
    cancelledOrdersCount: 0,
    avgOrderValue: 0,
    totalIngredientCOGS: 0,
    grossProfit: 0,
    totalOperatingExpenses: 0,
    netProfit: 0,
    pendingDeliveries: 0,
    lowStockCount: 0,
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-stone-100 text-stone-900 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Enterprise Console Sub-Header & Navigation */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900">
              Enterprise Restaurant Management &amp; Financial Console
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Signed in as <strong className="text-stone-800">{user?.name}</strong> (
              <span className="uppercase font-mono">{user?.role}</span>) · Dataset Mode:{' '}
              <strong className="uppercase font-mono text-amber-700">{dataMode}</strong>
            </p>
          </div>

          {/* 5 Main Module Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
                { id: 'customers', label: 'Customers, Installs & Logins', icon: ShieldCheck },
                { id: 'menu', label: 'Menu & Recipes CRUD', icon: UtensilsCrossed },
                { id: 'inventory', label: 'Inventory & Suppliers', icon: Package },
                { id: 'business', label: 'Staff, Expenses & Promos', icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            TAB 1: EXECUTIVE ANALYTICS, CHARTS & PDF/EXCEL EXPORT
           ==================================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Period Filter & Report Download Bar */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                        period === p
                          ? 'bg-white text-stone-950 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeDemo}
                    onChange={(e) => setExcludeDemo(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>Exclude Demo Seed Orders (Production Only)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    exportAnalyticsToPDF({
                      restaurantName: settings?.restaurantName || 'Ember & Oak Kitchen',
                      period,
                      metrics,
                      bestsellingProducts: analyticsData?.bestsellingProducts || [],
                      orders,
                      expenses: expenseList,
                    })
                  }
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF Report
                </button>
                <button
                  onClick={() =>
                    exportAnalyticsToExcel({
                      metrics,
                      bestsellingProducts: analyticsData?.bestsellingProducts || [],
                      orders,
                      inventory,
                      expenses: expenseList,
                    })
                  }
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* 8-Metric Financial & Operational Grid (Single-Elevation, Tabular Numerals) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Gross Sales Revenue</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-stone-900 mt-1">
                  ${metrics.totalRevenue.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Across {metrics.totalOrders} valid orders
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Average Order Value (AOV)</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-stone-900 mt-1">
                  ${metrics.avgOrderValue.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Active Queue: {metrics.pendingDeliveries} orders
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Gross Profit (Rev - Recipe COGS)</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-emerald-700 mt-1">
                  ${metrics.grossProfit.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500 mt-1 font-mono tabular-nums">
                  Recipe COGS: ${metrics.totalIngredientCOGS.toFixed(2)}
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Net Profit (After Expenses)</p>
                <p
                  className={`text-2xl font-mono font-bold tabular-nums mt-1 ${
                    metrics.netProfit >= 0 ? 'text-stone-900' : 'text-red-600'
                  }`}
                >
                  ${metrics.netProfit.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500 mt-1 font-mono tabular-nums">
                  Operating Expenses: ${metrics.totalOperatingExpenses.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Interactive Chart.js Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-display font-bold text-stone-900">
                      Revenue Performance ({period.toUpperCase()})
                    </h3>
                    <p className="text-xs text-stone-500">
                      Live database aggregation of completed and active order totals
                    </p>
                  </div>
                </div>
                <div className="h-64">
                  <Line
                    data={{
                      labels: analyticsData?.chartData.labels || [],
                      datasets: [
                        {
                          label: 'Revenue ($)',
                          data: analyticsData?.chartData.revenueSeries || [],
                          borderColor: '#d97706',
                          backgroundColor: 'rgba(217, 119, 6, 0.12)',
                          fill: true,
                          tension: 0.3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-display font-bold text-stone-900">
                    Order Volume by Period
                  </h3>
                  <p className="text-xs text-stone-500">
                    Total orders processed across online, POS, and delivery channels
                  </p>
                </div>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: analyticsData?.chartData.labels || [],
                      datasets: [
                        {
                          label: 'Orders',
                          data: analyticsData?.chartData.ordersSeries || [],
                          backgroundColor: '#1c1917',
                          borderRadius: 6,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bestselling Products & Low-Stock Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-display font-bold text-stone-900">
                  Bestselling Menu Items (Ranked by Revenue)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase">
                        <th className="py-2 px-3">Dish Name</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Units Sold</th>
                        <th className="py-2 px-3 text-right">Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {(analyticsData?.bestsellingProducts || []).map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-3 font-semibold text-stone-900">{item.name}</td>
                          <td className="py-2.5 px-3 text-stone-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {item.unitsSold}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-stone-900">
                            ${item.revenue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-stone-900">
                    Low-Stock Ingredient Alerts ({metrics.lowStockCount})
                  </h3>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Manage Inventory →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {inventory
                    .filter((i) => i.currentStock <= i.minStockLevel)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-red-200 bg-red-50/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-stone-900">{item.name}</p>
                            <p className="text-red-700 font-mono">
                              Current: {item.currentStock} {item.unit} (Min threshold:{' '}
                              {item.minStockLevel} {item.unit})
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustType('restock');
                            setAdjustQty('25');
                          }}
                          className="px-3 py-1.5 bg-stone-900 text-white font-semibold rounded-lg whitespace-nowrap shrink-0"
                        >
                          Restock
                        </button>
                      </div>
                    ))}
                  {inventory.filter((i) => i.currentStock <= i.minStockLevel).length === 0 && (
                    <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                      All kitchen ingredients are currently above minimum stock thresholds.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: FOOD MENU, CATEGORIES & RECIPES CRUD
           ==================================================================== */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu products..."
                  className="px-3.5 py-2 border border-stone-300 rounded-lg text-xs w-64"
                />
                <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name..."
                    className="px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    + Add Category
                  </button>
                </form>
              </div>

              <button
                onClick={() =>
                  setEditingProduct({
                    name: '',
                    categoryId: categories[0]?.id || 'cat-pizza',
                    description: '',
                    basePrice: 14.9,
                    prepTimeMinutes: 15,
                    image: PRESET_IMAGES[0].url,
                    isAvailable: true,
                    isFeatured: false,
                    sizes: [
                      { name: 'Regular', price: 0 },
                      { name: 'Large', price: 5.0 },
                    ],
                    crusts: [{ name: 'Artisan Hand-Tossed', price: 0 }],
                    toppings: [{ name: 'Extra Mozzarella', price: 2.5 }],
                    addOns: [{ name: 'Garlic Herb Dip', price: 1.5 }],
                    ingredientsList: ['Artisan Dough', 'Signature Sauce', 'Mozzarella'],
                    recipe: [
                      {
                        inventoryItemId: 'inv-flour',
                        ingredientName: 'Italian 00 Artisan Flour',
                        quantityPerUnit: 0.3,
                        unit: 'kg',
                      },
                    ],
                  })
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add New Menu Product
              </button>
            </div>

            {/* Products Table */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 uppercase">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Customizations</th>
                      <th className="py-3 px-4">Recipe Ingredients</th>
                      <th className="py-3 px-4 text-right">Base Price</th>
                      <th className="py-3 px-4">Availability</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {products
                      .filter((p) =>
                        !menuSearch.trim()
                          ? true
                          : p.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                            p.categoryName.toLowerCase().includes(menuSearch.toLowerCase())
                      )
                      .map((prod) => (
                        <tr key={prod.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-lg overflow-hidden bg-stone-900 shrink-0">
                                <SafeFoodImage
                                  src={prod.image}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-stone-900">{prod.name}</p>
                                <p className="text-[11px] text-stone-500 font-mono">
                                  Sold: {prod.totalSold} · ★ {prod.rating}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-stone-700 font-medium">{prod.categoryName}</td>
                          <td className="py-3 px-4 text-stone-500">
                            {prod.sizes.length} sizes · {prod.crusts.length} crusts ·{' '}
                            {prod.toppings.length} toppings
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            {prod.recipe?.map((r) => `${r.quantityPerUnit}${r.unit} ${r.ingredientName.split(' ')[0]}`).join(', ') || 'Standard'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            ${prod.basePrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={async () => {
                                await apiFetch(`/api/products/${prod.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ isAvailable: !prod.isAvailable }),
                                });
                                refreshAll();
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                                prod.isAvailable
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {prod.isAvailable ? 'In Stock (Active)' : 'Sold Out'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingProduct(prod)}
                                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded"
                                title="Edit Product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: INVENTORY, RECIPES & SUPPLIERS
           ==================================================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 Cols: Ingredients Stock Table */}
              <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-display font-bold text-stone-900">
                      Kitchen Ingredients &amp; Packaging Stock
                    </h3>
                    <p className="text-xs text-stone-500">
                      Stock automatically deducts according to product recipes when orders enter Preparing state.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase">
                        <th className="py-2.5 px-3">Ingredient</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Current Stock</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3">Expiry / Wastage</th>
                        <th className="py-2.5 px-3 text-right">Stock Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {inventory.map((item) => {
                        const isLow = item.currentStock <= item.minStockLevel;
                        return (
                          <tr key={item.id} className="hover:bg-stone-50">
                            <td className="py-3 px-3">
                              <p className="font-semibold text-stone-900">{item.name}</p>
                              <p className="text-[11px] text-stone-500">{item.supplierName}</p>
                            </td>
                            <td className="py-3 px-3 text-stone-600">{item.category}</td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span
                                className={`font-bold ${
                                  isLow ? 'text-red-600' : 'text-emerald-700'
                                }`}
                              >
                                {item.currentStock} {item.unit}
                              </span>
                              <span className="block text-[10px] text-stone-400">
                                {isLow ? 'LOW STOCK ALERT' : `Min: ${item.minStockLevel} ${item.unit}`}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              ${item.costPerUnit.toFixed(2)}/{item.unit}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-stone-600">
                              Exp: {item.expiryDate}
                              <span className="block text-stone-400">
                                Wastage: {item.wastageLogged} {item.unit}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setAdjustingItem(item);
                                    setAdjustType('restock');
                                    setAdjustQty('20');
                                  }}
                                  className="px-2.5 py-1 bg-stone-900 hover:bg-amber-600 text-white font-semibold rounded"
                                >
                                  + Restock
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjustingItem(item);
                                    setAdjustType('wastage');
                                    setAdjustQty('1');
                                  }}
                                  className="px-2 py-1 bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 font-medium rounded"
                                >
                                  Wastage
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right 4 Cols: Add Ingredient & Supplier Directory */}
              <div className="lg:col-span-4 space-y-6">
                <form
                  onSubmit={handleCreateInventoryItem}
                  className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-display font-bold text-stone-900">
                    Add New Inventory Ingredient
                  </h3>
                  <input
                    type="text"
                    required
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    placeholder="Ingredient name (e.g. Smoked Pepperoni)"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newIngCategory}
                      onChange={(e) =>
                        setNewIngCategory(e.target.value as IInventoryItem['category'])
                      }
                      className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                    >
                      <option value="Flour & Dough">Flour &amp; Dough</option>
                      <option value="Cheese & Dairy">Cheese &amp; Dairy</option>
                      <option value="Meats & Poultry">Meats &amp; Poultry</option>
                      <option value="Sauces & Oils">Sauces &amp; Oils</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Packaging">Packaging</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value)}
                      placeholder="Unit (kg, L, pcs)"
                      className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-stone-500">Initial Stock</label>
                      <input
                        type="number"
                        step="0.5"
                        value={newIngStock}
                        onChange={(e) => setNewIngStock(e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-500">Min Alert</label>
                      <input
                        type="number"
                        step="0.5"
                        value={newIngMin}
                        onChange={(e) => setNewIngMin(e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-500">Unit Cost ($)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newIngCost}
                        onChange={(e) => setNewIngCost(e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
                  >
                    + Register Ingredient
                  </button>
                </form>

                {/* Suppliers Directory */}
                <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-display font-bold text-stone-900">
                    Approved Vendors &amp; Suppliers ({suppliers.length})
                  </h3>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {suppliers.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border border-stone-200 bg-stone-50 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-semibold text-stone-900">
                          <span>{s.name}</span>
                          <span className="font-mono text-amber-700">
                            Due: ${s.balanceDue.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-stone-500">
                          {s.contactPerson} · {s.phone}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddSupplier} className="space-y-2 pt-2 border-t border-stone-200">
                    <input
                      type="text"
                      required
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="New supplier company name..."
                      className="w-full px-3 py-1.5 border border-stone-300 rounded text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={supContact}
                        onChange={(e) => setSupContact(e.target.value)}
                        placeholder="Contact person"
                        className="px-2.5 py-1.5 border border-stone-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                        placeholder="Phone number"
                        className="px-2.5 py-1.5 border border-stone-300 rounded text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs font-semibold rounded"
                    >
                      + Add Supplier
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: STAFF, OPERATING EXPENSES, COUPONS & DATA GOVERNANCE
           ==================================================================== */}
        {activeTab === 'business' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Staff & Attendance Management */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-display font-bold text-stone-900">
                    Staff Roster, Attendance &amp; Monthly Payroll
                  </h3>
                  <p className="text-xs text-stone-500">
                    Click any employee’s attendance button to cycle Present / Absent / On Leave.
                  </p>
                </div>

                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl">
                  {staffList.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-stone-900">
                          {member.name}{' '}
                          <span className="uppercase font-mono text-[11px] text-amber-700">
                            · {member.role}
                          </span>
                        </p>
                        <p className="text-stone-500 font-mono text-[11px]">
                          Salary: ${member.salaryMonthly.toLocaleString()}/mo · Days Present:{' '}
                          {member.daysPresentThisMonth}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleAttendance(member)}
                        className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap ${
                          member.attendanceToday === 'Present'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : member.attendanceToday === 'On Leave'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {member.attendanceToday}
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddStaff} className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Full Name"
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="Email"
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as UserRole)}
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="rider">Delivery Rider</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
                  >
                    + Hire Staff
                  </button>
                </form>
              </div>

              {/* Operating Expenses Ledger */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-display font-bold text-stone-900">
                    Operating Expenses &amp; Bills Ledger
                  </h3>
                  <p className="text-xs text-stone-500">
                    Directly deducted from Gross Profit to compute real Net Profit.
                  </p>
                </div>

                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl max-h-60 overflow-y-auto">
                  {expenseList.map((exp) => (
                    <div key={exp.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-stone-900">{exp.title}</p>
                        <p className="text-stone-500 text-[11px]">
                          {exp.category} · Paid to {exp.paidTo} ({exp.date})
                        </p>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-red-600">
                        -${exp.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddExpense} className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="Expense title..."
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Ingredient Purchase">Ingredient Purchase</option>
                    <option value="Salaries & Payroll">Salaries &amp; Payroll</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities (Electricity/Gas)">Utilities</option>
                    <option value="Packaging & Supplies">Packaging</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="Amount ($)"
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
                  >
                    + Log Expense
                  </button>
                </form>
              </div>
            </div>

            {/* Coupons & Data Governance / Security Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Promotional Coupons */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-display font-bold text-stone-900">
                  Promotional Campaigns &amp; Discount Coupons
                </h3>
                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl">
                  {coupons.map((c) => (
                    <div key={c.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-mono font-bold text-amber-700">
                          {c.code}{' '}
                          <span className="text-stone-500 font-sans font-normal">
                            ({c.usageCount} uses)
                          </span>
                        </p>
                        <p className="text-stone-600">{c.description}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await apiFetch(`/api/coupons/${c.id}/toggle`, { method: 'PATCH' });
                          refreshAll();
                        }}
                        className={`px-2.5 py-1 rounded font-semibold ${
                          c.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateCoupon} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="CODE (e.g. VIP25)"
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-mono uppercase"
                  />
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as 'percentage' | 'fixed')}
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                  <input
                    type="number"
                    required
                    value={couponVal}
                    onChange={(e) => setCouponVal(e.target.value)}
                    placeholder="Discount Val"
                    className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg"
                  >
                    + Create Promo
                  </button>
                </form>
              </div>

              {/* Environment Separation (Demo vs Production) & Security Audit Logs */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-base font-display font-bold text-stone-900">
                      Dataset Governance &amp; Security Audit Trail
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSwitchDataMode('demo')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        dataMode === 'demo'
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      Seed Demo Dataset
                    </button>
                    <button
                      onClick={() => handleSwitchDataMode('production')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        dataMode === 'production'
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      Clean Production Mode
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl max-h-56 overflow-y-auto bg-stone-50/60">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 text-xs space-y-0.5">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="font-bold text-stone-900">{log.action}</span>
                        <span className="text-stone-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-stone-600">{log.details}</p>
                      <p className="text-[10px] text-stone-400">
                        Actor: {log.actorName} ({log.actorRole})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: CUSTOMERS CRM, MOBILE APP INSTALLS, LOGINS & ORDERS FEED
           ==================================================================== */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            {/* Summary Metrics for Customer & Mobile App Activity */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Total Tracked Customers</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-stone-900 mt-1">
                  {customerList.length}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Registered &amp; Guest Profiles
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Mobile App Installs &amp; Launches</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-amber-700 mt-1">
                  {auditLogs.filter((l) => l.action === 'MOBILE_APP_INSTALLED').length + 1}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  PWA Home Screen Devices
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Recorded User Logins &amp; Signups</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-emerald-700 mt-1">
                  {
                    auditLogs.filter((l) =>
                      ['USER_LOGIN', 'CUSTOMER_REGISTERED'].includes(l.action)
                    ).length
                  }
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Real-time JWT auth events
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">Total Customer Orders</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-stone-900 mt-1">
                  {orders.length}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Live synced via Socket.IO
                </p>
              </div>
            </div>

            {/* Complete Customer Directory & Order History Table */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-display font-bold text-stone-900">
                    Complete Customer Directory — Contact Info, Addresses &amp; Ordered Items
                  </h3>
                  <p className="text-xs text-stone-500">
                    Every person who registers, logs in, or places an order (even as a Guest) appears here automatically.
                  </p>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by customer name, phone, email..."
                  className="px-3.5 py-2 border border-stone-300 rounded-lg text-xs w-full sm:w-72"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 uppercase">
                      <th className="py-3 px-3">Customer Name &amp; Type</th>
                      <th className="py-3 px-3">Phone &amp; Email</th>
                      <th className="py-3 px-3">Delivery Addresses</th>
                      <th className="py-3 px-3">Items Ordered</th>
                      <th className="py-3 px-3 text-right">Orders</th>
                      <th className="py-3 px-3 text-right">Total Spent</th>
                      <th className="py-3 px-3 text-right">Loyalty Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {customerList
                      .filter((c) => {
                        if (!customerSearch.trim()) return true;
                        const q = customerSearch.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.phone.toLowerCase().includes(q) ||
                          c.email.toLowerCase().includes(q)
                        );
                      })
                      .map((cust) => (
                        <tr key={cust.id} className="hover:bg-stone-50">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-stone-900">{cust.name}</p>
                            <p className="text-[11px] text-amber-700 font-medium">
                              {cust.accountType}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-mono font-medium text-stone-800">{cust.phone}</p>
                            <p className="text-[11px] text-stone-500">{cust.email}</p>
                          </td>
                          <td className="py-3 px-3 text-stone-600 max-w-xs">
                            {cust.addresses.length > 0
                              ? cust.addresses.join(' | ')
                              : 'Counter / Walk-in'}
                          </td>
                          <td className="py-3 px-3 text-stone-600 max-w-xs">
                            {cust.recentItems.length > 0
                              ? cust.recentItems.join(', ')
                              : 'No orders yet (Account Created)'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                            {cust.totalOrders}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                            ${cust.totalSpent.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                            {cust.loyaltyPoints} pts
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Mobile Installs, Logins & Order Activity Stream */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-display font-bold text-stone-900">
                  Live Activity Log — Who Installed the App, Who Logged In &amp; Who Ordered
                </h3>
                <p className="text-xs text-stone-500">
                  Real-time audit stream of mobile app installs, customer signups, user logins, and incoming orders.
                </p>
              </div>

              <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl max-h-80 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-stone-50"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900">{log.action}</span>
                        <span>·</span>
                        <span className="font-semibold text-amber-700">
                          {log.actorName} ({log.actorRole})
                        </span>
                      </div>
                      <p className="text-stone-600">{log.details}</p>
                    </div>
                    <span className="font-mono text-[11px] text-stone-400 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Create / Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-display font-bold">
                {editingProduct.id ? `Edit ${editingProduct.name}` : 'Create New Menu Product'}
              </h3>
              <button type="button" onClick={() => setEditingProduct(null)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Category *
                </label>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Base Price ($) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editingProduct.basePrice ?? 12.9}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, basePrice: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Prep Time (Minutes)
                </label>
                <input
                  type="number"
                  value={editingProduct.prepTimeMinutes ?? 15}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      prepTimeMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Product Image (Select Studio Preset or Enter Cloudinary / Image URL)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESET_IMAGES.map((img) => (
                  <button
                    key={img.label}
                    type="button"
                    onClick={() => setEditingProduct({ ...editingProduct, image: img.url })}
                    className={`p-1.5 rounded border text-[10px] text-left truncate ${
                      editingProduct.image === img.url
                        ? 'border-amber-600 bg-amber-50 font-semibold'
                        : 'border-stone-200'
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={editingProduct.image || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                placeholder="https://res.cloudinary.com/..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Description *
              </label>
              <textarea
                rows={2}
                required
                value={editingProduct.description || ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProduct.isAvailable !== false}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, isAvailable: e.target.checked })
                  }
                />
                <span>Available for Ordering</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editingProduct.isFeatured)}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })
                  }
                />
                <span>Chef Featured Signature</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-stone-900 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Restock / Wastage Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmInventoryAdjust}
            className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-display font-bold">
                {adjustType === 'restock' ? 'Restock Ingredient' : 'Log Kitchen Wastage'} —{' '}
                {adjustingItem.name}
              </h3>
              <button type="button" onClick={() => setAdjustingItem(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Current Stock:{' '}
              <strong className="font-mono">
                {adjustingItem.currentStock} {adjustingItem.unit}
              </strong>{' '}
              · Unit Cost: <strong className="font-mono">${adjustingItem.costPerUnit.toFixed(2)}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Quantity ({adjustingItem.unit}) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
              />
            </div>

            {adjustType === 'restock' && (
              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={recordPurchaseExpense}
                  onChange={(e) => setRecordPurchaseExpense(e.target.checked)}
                />
                <span>
                  Automatically log purchase cost ($
                  {(Number(adjustQty) * adjustingItem.costPerUnit).toFixed(2)}) in Operating Expenses
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-stone-900 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                Confirm {adjustType === 'restock' ? 'Restock' : 'Wastage'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
