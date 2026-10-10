import React, { useState, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  Banknote,
  CheckCircle2,
  Navigation,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { IOrder } from '../types/restaurant';

export const DeliveryRiderPanel: React.FC = () => {
  const { orders, riders, user, apiFetch, pushNotification, refreshAll } = useRestaurant();

  const [selectedRiderFilter, setSelectedRiderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'Delivered'>('active');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => {
      const isDeliveryOrPhone = o.orderType === 'delivery' || o.orderType === 'pos-phone';
      if (!isDeliveryOrPhone) return false;
      if (selectedRiderFilter !== 'all' && o.assignedRiderId !== selectedRiderFilter) return false;
      if (statusFilter === 'active') {
        return ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status);
      }
      return o.status === 'Delivered';
    });
  }, [orders, selectedRiderFilter, statusFilter]);

  const handleAssignRider = async (orderId: string, riderId: string) => {
    setProcessingId(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/assign-rider`, {
        method: 'PATCH',
        body: JSON.stringify({ riderId }),
      });
      pushNotification('Rider Assigned', 'Delivery order assigned to rider.');
      refreshAll();
    } catch (err) {
      pushNotification('Assignment Error', (err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartDelivery = async (order: IOrder) => {
    setProcessingId(order.id);
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Out for Delivery',
          assignedRiderId: order.assignedRiderId || riders[0]?.id,
        }),
      });
      pushNotification(
        `Order #${order.orderNumber} Out for Delivery`,
        'Customer notified with live ETA.'
      );
      refreshAll();
    } catch (err) {
      pushNotification('Dispatch Error', (err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCollectCashAndDeliver = async (order: IOrder) => {
    setProcessingId(order.id);
    try {
      if (!order.cashCollected) {
        await apiFetch(`/api/orders/${order.id}/collect-cash`, {
          method: 'PATCH',
          body: JSON.stringify({ markDelivered: true }),
        });
      } else {
        await apiFetch(`/api/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'Delivered' }),
        });
      }
      pushNotification(
        `Order #${order.orderNumber} Delivered`,
        order.paymentMethod === 'cash'
          ? `Collected $${order.totalAmount.toFixed(2)} cash & completed delivery.`
          : 'Completed delivery!'
      );
      refreshAll();
    } catch (err) {
      pushNotification('Delivery Error', (err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const totalCashCollectedToday = useMemo(() => {
    return orders
      .filter((o) => o.orderType === 'delivery' && o.paymentMethod === 'cash' && o.cashCollected)
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const pendingCashToCollect = useMemo(() => {
    return orders
      .filter(
        (o) =>
          o.orderType === 'delivery' &&
          o.paymentMethod === 'cash' &&
          !o.cashCollected &&
          o.status !== 'Cancelled'
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-stone-100 text-stone-900 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Rider Console Header & Cash Summary */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-stone-900">
                Delivery Rider Dispatch &amp; Cash Collection Panel
              </h1>
              <p className="text-xs text-stone-500">
                Active Operator: <strong className="text-stone-800">{user?.name || 'Tariq Hassan'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-stone-500 block">Pending COD Cash on Route</span>
              <span className="text-base font-mono font-bold tabular-nums text-amber-700">
                ${pendingCashToCollect.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-stone-500 block">Settled COD Cash Collected</span>
              <span className="text-base font-mono font-bold tabular-nums text-emerald-700">
                ${totalCashCollectedToday.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/80 rounded-lg">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Active Dispatches
            </button>
            <button
              onClick={() => setStatusFilter('Delivered')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                statusFilter === 'Delivered'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Completed Deliveries
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-600">Filter by Rider:</span>
            <select
              value={selectedRiderFilter}
              onChange={(e) => setSelectedRiderFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium"
            >
              <option value="all">All Delivery Riders</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delivery Cards Grid */}
        {deliveryOrders.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center space-y-2">
            <Truck className="w-9 h-9 text-stone-400 mx-auto" />
            <p className="text-base font-semibold text-stone-800">No delivery dispatches in this view</p>
            <p className="text-xs text-stone-500">
              Switch to All Delivery Riders or place a new delivery order on the Storefront.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {deliveryOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-4 bg-stone-950 text-white flex items-center justify-between">
                    <div>
                      <span className="font-mono text-base font-bold">#{order.orderNumber}</span>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Status: <strong className="text-amber-400">{order.status}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold tabular-nums">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                      <p className="text-[11px] uppercase text-stone-400">
                        {order.paymentMethod === 'cash' && !order.cashCollected
                          ? 'Collect Cash (COD)'
                          : 'Prepaid / Settled'}
                      </p>
                    </div>
                  </div>

                  {/* Customer Contact & Destination */}
                  <div className="p-4 space-y-3 text-xs border-b border-stone-100">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-stone-900">
                          {order.deliveryAddress || 'Counter / Local Zone'}
                        </p>
                        {order.deliveryZone && (
                          <p className="text-stone-500 text-[11px]">{order.deliveryZone}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span className="font-medium text-stone-800">{order.customerName}</span>
                      </div>
                      <span className="font-mono text-stone-600">{order.customerPhone}</span>
                    </div>

                    <div className="flex items-center justify-between text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Target ETA:
                      </span>
                      <span className="font-mono font-semibold text-stone-800">
                        {order.estimatedDeliveryMinutes} mins
                      </span>
                    </div>

                    {order.orderNotes && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                        Delivery Note: “{order.orderNotes}”
                      </div>
                    )}
                  </div>

                  {/* Rider Assignment Selector */}
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Rider:
                    </span>
                    <select
                      value={order.assignedRiderId || ''}
                      onChange={(e) => handleAssignRider(order.id, e.target.value)}
                      disabled={processingId === order.id}
                      className="px-2.5 py-1 bg-white border border-stone-300 rounded-md text-xs font-medium"
                    >
                      <option value="">-- Assign Rider --</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Compact Items List */}
                  <div className="p-4 space-y-1 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-stone-700">
                        <span>
                          <strong>{item.quantity}×</strong> {item.productName}
                        </span>
                        <span className="font-mono tabular-nums">${item.lineTotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rider Action Buttons */}
                {order.status !== 'Delivered' && (
                  <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-2">
                    {order.status !== 'Out for Delivery' && (
                      <button
                        disabled={processingId === order.id}
                        onClick={() => handleStartDelivery(order)}
                        className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-amber-400" />
                        Pick Up Order &amp; Start Delivery Route
                      </button>
                    )}

                    <button
                      disabled={processingId === order.id}
                      onClick={() => handleCollectCashAndDeliver(order)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {order.paymentMethod === 'cash' && !order.cashCollected ? (
                        <>
                          <Banknote className="w-4 h-4" />
                          Collect ${order.totalAmount.toFixed(2)} Cash &amp; Mark Delivered
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Handover &amp; Mark Delivered
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
