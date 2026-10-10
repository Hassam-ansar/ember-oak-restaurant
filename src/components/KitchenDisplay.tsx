import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle2, Flame, ChefHat, AlertTriangle, PackageCheck } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { IOrder, OrderStatus } from '../types/restaurant';

export const KitchenDisplay: React.FC = () => {
  const { orders, user, apiFetch, pushNotification, refreshAll } = useRestaurant();
  const [filterStatus, setFilterStatus] = useState<'active' | 'Pending' | 'Confirmed' | 'Preparing' | 'Ready'>('active');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Live 1-second tick for preparation timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const kitchenOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterStatus === 'active') {
        return ['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(o.status);
      }
      return o.status === filterStatus;
    });
  }, [orders, filterStatus]);

  const formatElapsed = (order: IOrder) => {
    const refTime = order.prepStartedAt
      ? new Date(order.prepStartedAt).getTime()
      : new Date(order.createdAt).getTime();
    const diffSec = Math.max(0, Math.floor((nowMs - refTime) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return {
      text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      mins,
    };
  };

  const handleStatusUpdate = async (order: IOrder, nextStatus: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushNotification(
        `KDS: Order #${order.orderNumber}`,
        nextStatus === 'Preparing'
          ? 'Started preparation & automatically deducted recipe ingredients from inventory.'
          : nextStatus === 'Ready'
          ? 'Marked Ready! Notified POS Cashier & Delivery Rider.'
          : `Updated to ${nextStatus}.`
      );
      refreshAll();
    } catch (err) {
      pushNotification('KDS Update Error', (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-stone-950 text-stone-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* KDS Header & Stage Filters */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ChefHat className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-lg font-display font-bold text-white">
                Kitchen Display System (KDS) — Live Ticket Board
              </h1>
              <p className="text-xs text-stone-400">
                Lead Line: <strong className="text-stone-200">{user?.name || 'Chef Mateo Silva'}</strong> ·
                Starting preparation automatically deducts recipe quantities from Inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-stone-950 border border-stone-800 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'active', label: 'All Active Tickets' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Confirmed', label: 'Confirmed' },
                { id: 'Preparing', label: 'In Kiln / Grill' },
                { id: 'Ready', label: 'Ready for Pickup' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterStatus === tab.id
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket Grid */}
        {kitchenOrders.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-14 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-white">All Kitchen Tickets Cleared</p>
            <p className="text-xs text-stone-400">
              New online, POS walk-in, takeaway, and phone orders appear here automatically in real time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {kitchenOrders.map((order) => {
              const elapsed = formatElapsed(order);
              const isOverdue = elapsed.mins >= 20 && order.status !== 'Ready';

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border flex flex-col justify-between overflow-hidden ${
                    order.status === 'Ready'
                      ? 'bg-stone-900/90 border-emerald-700/80'
                      : order.status === 'Preparing'
                      ? 'bg-stone-900 border-amber-600/80'
                      : 'bg-stone-900 border-stone-800'
                  }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div
                      className={`px-4 py-3 border-b flex items-center justify-between ${
                        order.status === 'Ready'
                          ? 'bg-emerald-950/60 border-emerald-800/60'
                          : order.status === 'Preparing'
                          ? 'bg-amber-950/50 border-amber-800/60'
                          : 'bg-stone-950 border-stone-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-white">
                            #{order.orderNumber}
                          </span>
                          <span className="text-xs uppercase font-semibold text-amber-400">
                            · {order.orderType}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {order.customerName}{' '}
                          {order.tableNumber ? `· ${order.tableNumber}` : ''}
                        </p>
                      </div>

                      {/* Preparation Elapsed Timer */}
                      <div className="text-right">
                        <div
                          className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${
                            isOverdue
                              ? 'text-red-400'
                              : order.status === 'Ready'
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsed.text}</span>
                        </div>
                        <p className="text-[11px] text-stone-400 uppercase font-medium">
                          {order.status}
                        </p>
                      </div>
                    </div>

                    {/* Order Global Notes */}
                    {order.orderNotes && (
                      <div className="px-4 py-2 bg-amber-950/30 border-b border-stone-800 text-xs text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Order Note: “{order.orderNotes}”</span>
                      </div>
                    )}

                    {/* Itemized Kitchen Build List */}
                    <div className="p-4 divide-y divide-stone-800 space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="pt-3 first:pt-0 space-y-1">
                          <div className="flex items-start gap-2.5">
                            <span className="px-2 py-0.5 bg-stone-800 text-amber-400 font-mono text-xs font-bold rounded tabular-nums">
                              {item.quantity}×
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white leading-snug">
                                {item.productName}
                              </p>
                              <div className="text-xs text-stone-300 space-y-0.5 mt-1">
                                {item.selectedSize && (
                                  <p>
                                    <span className="text-stone-500">Size:</span>{' '}
                                    <strong>{item.selectedSize.name}</strong>
                                  </p>
                                )}
                                {item.selectedCrust && (
                                  <p>
                                    <span className="text-stone-500">Crust:</span>{' '}
                                    <strong className="text-amber-300">
                                      {item.selectedCrust.name}
                                    </strong>
                                  </p>
                                )}
                                {item.selectedToppings && item.selectedToppings.length > 0 && (
                                  <p>
                                    <span className="text-stone-500">+ Toppings:</span>{' '}
                                    {item.selectedToppings.map((t) => t.name).join(', ')}
                                  </p>
                                )}
                                {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                                  <p>
                                    <span className="text-stone-500">+ Sides/Dips:</span>{' '}
                                    {item.selectedAddOns.map((a) => a.name).join(', ')}
                                  </p>
                                )}
                                {item.specialInstructions && (
                                  <p className="text-amber-300 font-medium bg-amber-950/60 px-2 py-1 rounded mt-1">
                                    Kitchen Instruction: “{item.specialInstructions}”
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KDS Action Footer */}
                  <div className="p-4 bg-stone-950 border-t border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span>
                        Recipe Stock:{' '}
                        <strong className={order.inventoryDeducted ? 'text-emerald-400' : 'text-stone-300'}>
                          {order.inventoryDeducted ? 'Deducted from Inventory' : 'Pending Prep Start'}
                        </strong>
                      </span>
                      <span>
                        Rider: {order.assignedRiderName ? order.assignedRiderName.split(' ')[0] : 'Unassigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {order.status === 'Pending' && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusUpdate(order, 'Confirmed')}
                          className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Acknowledge &amp; Confirm Ticket
                        </button>
                      )}

                      {(order.status === 'Pending' || order.status === 'Confirmed') && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusUpdate(order, 'Preparing')}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Flame className="w-4 h-4" />
                          Start Preparing (Deduct Recipe Stock)
                        </button>
                      )}

                      {order.status === 'Preparing' && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusUpdate(order, 'Ready')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PackageCheck className="w-4 h-4" />
                          Mark Order Ready &amp; Notify Dispatch
                        </button>
                      )}

                      {order.status === 'Ready' && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() =>
                            handleStatusUpdate(
                              order,
                              order.orderType === 'delivery' ? 'Out for Delivery' : 'Delivered'
                            )
                          }
                          className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg transition-colors"
                        >
                          {order.orderType === 'delivery'
                            ? 'Hand Off to Delivery Rider'
                            : 'Complete Counter Pickup (Delivered)'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
