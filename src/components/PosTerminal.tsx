import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  RotateCcw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  IProduct,
  IProductOption,
  IOrder,
  OrderType,
  PaymentMethod,
} from '../types/restaurant';

interface PosTicketItem {
  key: string;
  product: IProduct;
  quantity: number;
  selectedSize?: IProductOption;
  selectedCrust?: IProductOption;
  selectedToppings: IProductOption[];
  specialInstructions?: string;
  unitPrice: number;
}

export const PosTerminal: React.FC = () => {
  const {
    settings,
    categories,
    products,
    orders,
    user,
    apiFetch,
    pushNotification,
    refreshAll,
  } = useRestaurant();

  const [posView, setPosView] = useState<'register' | 'orders'>('register');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Ticket State
  const [ticketItems, setTicketItems] = useState<PosTicketItem[]>([]);
  const [posOrderType, setPosOrderType] = useState<OrderType>('pos-walkin');
  const [customerName, setCustomerName] = useState<string>('Walk-In Guest');
  const [customerPhone, setCustomerPhone] = useState<string>('+1-555-0100');
  const [tableNumber, setTableNumber] = useState<string>('Table 02');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [customDiscount, setCustomDiscount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Quick Product Customizer Modal
  const [customizingProduct, setCustomizingProduct] = useState<IProduct | null>(null);
  const [selSize, setSelSize] = useState<IProductOption | undefined>();
  const [selCrust, setSelCrust] = useState<IProductOption | undefined>();
  const [selToppings, setSelToppings] = useState<IProductOption[]>([]);
  const [itemNote, setItemNote] = useState<string>('');

  // Receipt Modal & Refund Modal State
  const [receiptOrder, setReceiptOrder] = useState<IOrder | null>(null);
  const [refundTargetOrder, setRefundTargetOrder] = useState<IOrder | null>(null);
  const [refundReason, setRefundReason] = useState<string>('Customer requested item cancellation');
  const [orderSearch, setOrderSearch] = useState<string>('');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isAvailable) return false;
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (searchQuery.trim() && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const addProductToTicket = (
    product: IProduct,
    size?: IProductOption,
    crust?: IProductOption,
    toppings: IProductOption[] = [],
    note?: string
  ) => {
    const sz = size || product.sizes[0];
    const cr = crust || product.crusts[0];
    const unitPrice = Number(
      (
        product.basePrice +
        (sz?.price || 0) +
        (cr?.price || 0) +
        toppings.reduce((s, t) => s + t.price, 0)
      ).toFixed(2)
    );
    const key = `${product.id}-${sz?.name || ''}-${cr?.name || ''}-${toppings
      .map((t) => t.name)
      .join(',')}-${note || ''}`;

    setTicketItems((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          product,
          quantity: 1,
          selectedSize: sz,
          selectedCrust: cr,
          selectedToppings: toppings,
          specialInstructions: note,
          unitPrice,
        },
      ];
    });
  };

  const ticketTotals = useMemo(() => {
    const subtotal = Number(
      ticketItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    );
    const discountAmount = Math.min(subtotal, Math.max(0, Number(customDiscount) || 0));
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxRate = settings?.taxRatePercent || 8.5;
    const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
    const totalAmount = Number((taxable + taxAmount).toFixed(2));
    const tendered = Number(cashTendered) || totalAmount;
    const changeDue = Math.max(0, Number((tendered - totalAmount).toFixed(2)));

    return { subtotal, discountAmount, taxAmount, totalAmount, changeDue };
  }, [ticketItems, customDiscount, cashTendered, settings]);

  const handleCompletePosSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketItems.length === 0) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<IOrder>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: customerName || 'Walk-In Guest',
          customerPhone: customerPhone || '+1-555-0000',
          orderType: posOrderType,
          tableNumber: posOrderType === 'pos-walkin' ? tableNumber : undefined,
          deliveryAddress: posOrderType === 'pos-phone' ? deliveryAddress : undefined,
          customDiscountAmount: ticketTotals.discountAmount,
          paymentMethod,
          markPaid: true,
          orderNotes,
          items: ticketItems.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            selectedSizeName: i.selectedSize?.name,
            selectedCrustName: i.selectedCrust?.name,
            selectedToppingNames: i.selectedToppings.map((t) => t.name),
            specialInstructions: i.specialInstructions,
          })),
        }),
      });

      setTicketItems([]);
      setCustomDiscount('0');
      setCashTendered('');
      setOrderNotes('');
      setReceiptOrder(created);
      refreshAll();
    } catch (err) {
      pushNotification('POS Error', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTargetOrder) return;
    try {
      await apiFetch(`/api/orders/${refundTargetOrder.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason }),
      });
      pushNotification(
        'Order Refunded',
        `Order #${refundTargetOrder.orderNumber} refunded and cancelled.`
      );
      setRefundTargetOrder(null);
      refreshAll();
    } catch (err) {
      pushNotification('Refund Failed', (err as Error).message);
    }
  };

  const handleCollectPosCash = async (order: IOrder) => {
    try {
      await apiFetch(`/api/orders/${order.id}/collect-cash`, {
        method: 'PATCH',
        body: JSON.stringify({ markDelivered: false }),
      });
      pushNotification('Payment Recorded', `Marked Order #${order.orderNumber} as Paid.`);
      refreshAll();
    } catch (err) {
      pushNotification('Payment Error', (err as Error).message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-stone-100 text-stone-900 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* POS Header Toolbar */}
        <div className="bg-white border border-stone-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-display font-bold text-stone-900">
                Point of Sale (POS) Terminal
              </h1>
              <p className="text-xs text-stone-500">
                Cashier: <strong className="text-stone-800">{user?.name || 'Devon Brooks'}</strong> ·
                Tax Rate: <span className="font-mono">{settings?.taxRatePercent || 8.5}%</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setPosView('register')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                posView === 'register'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Cash Register &amp; Order Entry
            </button>
            <button
              onClick={() => setPosView('orders')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                posView === 'orders'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Receipts, Payments &amp; Refunds ({orders.length})
            </button>
          </div>
        </div>

        {posView === 'register' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 7 COLS: Fast Menu Keypad */}
            <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Quick search item by name..."
                    className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                    selectedCategory === 'all'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  All Items
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                      selectedCategory === c.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* POS Keypad Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[62vh] overflow-y-auto pr-1">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3.5 rounded-xl border border-stone-200 hover:border-amber-600 bg-stone-50/60 flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div>
                      <p className="text-[11px] text-stone-400 uppercase font-medium truncate">
                        {prod.categoryName}
                      </p>
                      <h3 className="text-xs font-semibold text-stone-900 mt-0.5 line-clamp-2">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/80">
                      <span className="font-mono text-xs font-bold tabular-nums text-stone-900">
                        ${prod.basePrice.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomizingProduct(prod);
                            setSelSize(prod.sizes[0]);
                            setSelCrust(prod.crusts[0]);
                            setSelToppings([]);
                            setItemNote('');
                          }}
                          className="px-2 py-1 text-[11px] font-medium bg-white border border-stone-300 rounded hover:border-stone-900"
                        >
                          Options
                        </button>
                        <button
                          type="button"
                          onClick={() => addProductToTicket(prod)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-stone-900 hover:bg-amber-600 text-white rounded"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT 5 COLS: Active Ticket & Payment Calculator */}
            <form
              onSubmit={handleCompletePosSale}
              className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-4"
            >
              {/* Order Type Mode: Walk-in, Takeaway, Phone */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-lg">
                {(
                  [
                    { id: 'pos-walkin', label: 'Walk-In / Dine' },
                    { id: 'takeaway', label: 'Counter Takeaway' },
                    { id: 'pos-phone', label: 'Phone Order' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPosOrderType(t.id)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors ${
                      posOrderType === t.id
                        ? 'bg-white text-stone-950 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Customer & Table Metadata */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {posOrderType === 'pos-walkin' && (
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Table / Pager Number
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {posOrderType === 'pos-phone' && (
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Phone Delivery Address
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street address for phone dispatch..."
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {/* Ticket Line Items */}
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-200 max-h-60 overflow-y-auto bg-stone-50/50">
                {ticketItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-400">
                    Tap items on the left keypad to build POS ticket.
                  </div>
                ) : (
                  ticketItems.map((item) => (
                    <div key={item.key} className="p-3 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-stone-900 truncate">{item.product.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {item.selectedSize?.name}{' '}
                          {item.selectedCrust ? `· ${item.selectedCrust.name}` : ''}
                          {item.selectedToppings.length > 0
                            ? ` · +${item.selectedToppings.length} toppings`
                            : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setTicketItems((prev) =>
                              prev
                                .map((x) =>
                                  x.key === item.key ? { ...x, quantity: x.quantity - 1 } : x
                                )
                                .filter((x) => x.quantity > 0)
                            )
                          }
                          className="p-1 bg-white border border-stone-300 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-semibold tabular-nums w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTicketItems((prev) =>
                              prev.map((x) =>
                                x.key === item.key ? { ...x, quantity: x.quantity + 1 } : x
                              )
                            )
                          }
                          className="p-1 bg-white border border-stone-300 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-mono font-semibold tabular-nums w-16 text-right">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Payment Tender Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Manual Discount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={customDiscount}
                    onChange={(e) => setCustomDiscount(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">
                    Cash Tendered ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={ticketTotals.totalAmount.toFixed(2)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Payment Method Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'card', label: 'Card POS', icon: CreditCard },
                    { id: 'online', label: 'Online QR', icon: Smartphone },
                  ] as const
                ).map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                        paymentMethod === pm.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Totals Breakdown */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">${ticketTotals.subtotal.toFixed(2)}</span>
                </div>
                {ticketTotals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>POS Discount</span>
                    <span className="font-mono tabular-nums">
                      -${ticketTotals.discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>Sales Tax ({settings?.taxRatePercent || 8.5}%)</span>
                  <span className="font-mono tabular-nums">${ticketTotals.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-stone-950 pt-1.5 border-t border-stone-200">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums">${ticketTotals.totalAmount.toFixed(2)}</span>
                </div>
                {paymentMethod === 'cash' && Number(cashTendered) > ticketTotals.totalAmount && (
                  <div className="flex justify-between text-xs font-semibold text-amber-700 pt-1">
                    <span>Change Due to Customer</span>
                    <span className="font-mono tabular-nums">${ticketTotals.changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTicketItems([])}
                  className="px-3.5 py-3 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={ticketItems.length === 0 || submitting}
                  className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-300 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Processing Ticket...'
                      : `Charge $${ticketTotals.totalAmount.toFixed(2)} & Print Receipt`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* POS ORDERS, RECEIPTS & REFUNDS TABLE */
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-display font-bold text-stone-900">
                  All Orders — Receipt Printing, Cash Collection &amp; Refunds
                </h2>
                <p className="text-xs text-stone-500">
                  Print thermal receipts, collect pending cash payments, or issue authorized refunds.
                </p>
              </div>
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Filter by Order #, customer, phone..."
                className="px-3.5 py-2 border border-stone-200 rounded-lg text-xs w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase">
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Kitchen Status</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">POS Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {orders
                    .filter((o) => {
                      if (!orderSearch.trim()) return true;
                      const q = orderSearch.toLowerCase();
                      return (
                        o.orderNumber.toLowerCase().includes(q) ||
                        o.customerName.toLowerCase().includes(q) ||
                        o.customerPhone.toLowerCase().includes(q)
                      );
                    })
                    .map((ord) => (
                      <tr key={ord.id} className="hover:bg-stone-50">
                        <td className="py-3 px-3 font-mono font-bold text-stone-900">
                          #{ord.orderNumber}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-stone-900">{ord.customerName}</p>
                          <p className="text-[11px] text-stone-500 font-mono">{ord.customerPhone}</p>
                        </td>
                        <td className="py-3 px-3 uppercase font-medium text-stone-600">
                          {ord.orderType}
                        </td>
                        <td className="py-3 px-3 font-semibold text-stone-800">{ord.status}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-mono font-semibold ${
                              ord.paymentStatus === 'Paid'
                                ? 'text-emerald-700'
                                : ord.paymentStatus === 'Refunded'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {ord.paymentMethod.toUpperCase()} · {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                          ${ord.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setReceiptOrder(ord)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-medium flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" />
                              Receipt
                            </button>
                            {ord.paymentStatus === 'Pending' && ord.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleCollectPosCash(ord)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Mark Paid
                              </button>
                            )}
                            {ord.status !== 'Cancelled' && ord.paymentStatus !== 'Refunded' && (
                              <button
                                onClick={() => setRefundTargetOrder(ord)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded font-medium flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Option Customizer Modal for POS */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm font-display font-bold">{customizingProduct.name}</h3>
              <button onClick={() => setCustomizingProduct(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {customizingProduct.sizes.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingProduct.sizes.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setSelSize(s)}
                      className={`p-2 rounded border text-xs text-left flex justify-between ${
                        selSize?.name === s.name
                          ? 'border-amber-600 bg-amber-50 font-semibold'
                          : 'border-stone-200'
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className="font-mono">+${s.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {customizingProduct.crusts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Crust</label>
                <div className="space-y-1.5">
                  {customizingProduct.crusts.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelCrust(c)}
                      className={`w-full p-2 rounded border text-xs text-left flex justify-between ${
                        selCrust?.name === c.name
                          ? 'border-amber-600 bg-amber-50 font-semibold'
                          : 'border-stone-200'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="font-mono">+${c.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Kitchen Note
              </label>
              <input
                type="text"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder="No onions, extra crispy..."
                className="w-full px-3 py-1.5 border border-stone-300 rounded text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                addProductToTicket(customizingProduct, selSize, selCrust, selToppings, itemNote);
                setCustomizingProduct(null);
              }}
              className="w-full py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-lg"
            >
              Add Customized Item to Ticket
            </button>
          </div>
        </div>
      )}

      {/* Printable 80mm Thermal Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div id="pos-printable-receipt" className="font-mono text-xs text-stone-900 space-y-3">
              <div className="text-center border-b border-dashed border-stone-400 pb-3">
                <p className="font-bold text-sm uppercase">{settings?.restaurantName}</p>
                <p className="text-[11px] text-stone-600">{settings?.address}</p>
                <p className="text-[11px] text-stone-600">Tel: {settings?.phone}</p>
              </div>

              <div className="border-b border-dashed border-stone-400 pb-2 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>RECEIPT:</span>
                  <span className="font-bold">#{receiptOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date(receiptOrder.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span>{receiptOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>TYPE:</span>
                  <span>
                    {receiptOrder.orderType.toUpperCase()}{' '}
                    {receiptOrder.tableNumber ? `(${receiptOrder.tableNumber})` : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-stone-400 pb-2">
                {receiptOrder.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between font-semibold">
                      <span>
                        {item.quantity}x {item.productName}
                      </span>
                      <span>${item.lineTotal.toFixed(2)}</span>
                    </div>
                    {item.selectedSize && (
                      <p className="text-[10px] text-stone-500 pl-3">- {item.selectedSize.name}</p>
                    )}
                    {item.selectedCrust && (
                      <p className="text-[10px] text-stone-500 pl-3">- {item.selectedCrust.name}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>${receiptOrder.subtotal.toFixed(2)}</span>
                </div>
                {receiptOrder.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>DISCOUNT:</span>
                    <span>-${receiptOrder.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>TAX:</span>
                  <span>${receiptOrder.taxAmount.toFixed(2)}</span>
                </div>
                {receiptOrder.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>DELIVERY FEE:</span>
                    <span>${receiptOrder.deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-stone-400">
                  <span>TOTAL:</span>
                  <span>${receiptOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>PAYMENT:</span>
                  <span>
                    {receiptOrder.paymentMethod.toUpperCase()} ({receiptOrder.paymentStatus})
                  </span>
                </div>
              </div>

              <p className="text-center text-[10px] text-stone-500 pt-2">
                Thank you for dining with Ember &amp; Oak!
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Thermal Receipt
              </button>
              <button
                onClick={() => setReceiptOrder(null)}
                className="px-4 py-2.5 border border-stone-300 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund & Cancellation Authorization Modal */}
      {refundTargetOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleIssueRefund}
            className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-display font-bold text-red-700">
                Authorize Refund — Order #{refundTargetOrder.orderNumber}
              </h3>
              <button type="button" onClick={() => setRefundTargetOrder(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Refunding <strong className="font-mono">${refundTargetOrder.totalAmount.toFixed(2)}</strong>{' '}
              to {refundTargetOrder.customerName}. This action logs a Refund record and marks the order as Cancelled.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Reason for Refund / Cancellation *
              </label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundTargetOrder(null)}
                className="px-4 py-2 border border-stone-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg"
              >
                Confirm Refund (${refundTargetOrder.totalAmount.toFixed(2)})
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
