import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  IUser,
  ICategory,
  IProduct,
  IOrder,
  IInventoryItem,
  ISupplier,
  ICoupon,
  IReview,
  IRestaurantSettings,
  CartItem,
  IProductOption,
  UserRole,
} from '../types/restaurant';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
}

interface RestaurantContextValue {
  loading: boolean;
  dataMode: 'demo' | 'production';
  settings: IRestaurantSettings | null;
  categories: ICategory[];
  products: IProduct[];
  orders: IOrder[];
  inventory: IInventoryItem[];
  suppliers: ISupplier[];
  coupons: ICoupon[];
  reviews: IReview[];
  riders: { id: string; name: string; phone: string }[];
  user: IUser | null;
  token: string | null;
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  notifications: ToastNotification[];
  dismissNotification: (id: string) => void;
  pushNotification: (title: string, message: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  switchRole: (role: UserRole) => Promise<IUser>;
  logout: () => void;
  toggleFavorite: (productId: string) => Promise<void>;
  addToCart: (params: {
    product: IProduct;
    quantity: number;
    selectedSize?: IProductOption;
    selectedCrust?: IProductOption;
    selectedToppings: IProductOption[];
    selectedAddOns: IProductOption[];
    specialInstructions?: string;
  }) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  reorderPastOrder: (order: IOrder) => void;
  refreshAll: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [dataMode, setDataMode] = useState<'demo' | 'production'>('demo');
  const [settings, setSettings] = useState<IRestaurantSettings | null>(null);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [inventory, setInventory] = useState<IInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [coupons, setCoupons] = useState<ICoupon[]>([]);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [riders, setRiders] = useState<{ id: string; name: string; phone: string }[]>([]);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('eo_token'));
  const [user, setUser] = useState<IUser | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const pushNotification = useCallback((title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotifications((prev) => [{ id, title, message }, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };
      const currentToken = localStorage.getItem('eo_token') || token;
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data as T;
    },
    [token]
  );

  const refreshAll = useCallback(async () => {
    try {
      const [boot, ordList, invData] = await Promise.all([
        apiFetch<{
          dataMode: 'demo' | 'production';
          settings: IRestaurantSettings;
          categories: ICategory[];
          products: IProduct[];
          coupons: ICoupon[];
          reviews: IReview[];
          riders: { id: string; name: string; phone: string }[];
        }>('/api/bootstrap'),
        apiFetch<IOrder[]>('/api/orders'),
        apiFetch<{ inventory: IInventoryItem[]; suppliers: ISupplier[] }>('/api/inventory'),
      ]);
      setDataMode(boot.dataMode);
      setSettings(boot.settings);
      setCategories(boot.categories);
      setProducts(boot.products);
      setCoupons(boot.coupons);
      setReviews(boot.reviews);
      setRiders(boot.riders);
      setOrders(ordList);
      setInventory(invData.inventory);
      setSuppliers(invData.suppliers);
    } catch (err) {
      console.error('Error bootstrapping restaurant data:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Initial auth & data load (Never auto-login as demo Sophia Chen)
  useEffect(() => {
    refreshAll();
    const savedToken = localStorage.getItem('eo_token');
    if (savedToken) {
      apiFetch<{ user: IUser }>('/api/auth/me')
        .then((res) => {
          if (
            res.user.email === 'customer@emberandoak.com' ||
            res.user.name.toLowerCase().includes('sophia chen')
          ) {
            localStorage.removeItem('eo_token');
            setToken(null);
            setUser(null);
          } else {
            setUser(res.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('eo_token');
          setToken(null);
          setUser(null);
        });
    }
  }, [refreshAll, apiFetch]);

  // Real-time Socket.IO connection
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
    });

    // Idempotent order creation handler
    socket.on('order:created', (newOrder: IOrder) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
    });

    // Idempotent order update handler
    socket.on('order:updated', (updatedOrder: IOrder) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (!exists) return [updatedOrder, ...prev];
        return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      });
    });

    socket.on('inventory:updated', (updatedInv: IInventoryItem[]) => {
      setInventory(updatedInv);
    });

    socket.on('menu:updated', () => {
      refreshAll();
    });

    socket.on('notification:broadcast', (notif: { id: string; title: string; message: string }) => {
      pushNotification(notif.title, notif.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshAll, pushNotification]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: IUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('eo_token', res.token);
    setToken(res.token);
    setUser(res.user);
    pushNotification('Signed In', `Welcome back, ${res.user.name}`);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await apiFetch<{ token: string; user: IUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    });
    localStorage.setItem('eo_token', res.token);
    setToken(res.token);
    setUser(res.user);
    pushNotification('Account Created', 'Welcome! 100 bonus loyalty points added to your profile.');
  };

  const switchRole = async (role: UserRole): Promise<IUser> => {
    const res = await apiFetch<{ token: string; user: IUser }>('/api/auth/quick-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    localStorage.setItem('eo_token', res.token);
    setToken(res.token);
    setUser(res.user);
    pushNotification('Active Role Switched', `Signed in as ${res.user.name} (${res.user.role.toUpperCase()})`);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('eo_token');
    setToken(null);
    setUser(null);
    pushNotification('Signed Out', 'Checking out as Guest is still available.');
  };

  const toggleFavorite = async (productId: string) => {
    if (!user) {
      pushNotification('Sign in Required', 'Please sign in to save favorite dishes.');
      return;
    }
    const res = await apiFetch<{ user: IUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ toggleFavoriteProductId: productId }),
    });
    setUser(res.user);
  };

  const addToCart = (params: {
    product: IProduct;
    quantity: number;
    selectedSize?: IProductOption;
    selectedCrust?: IProductOption;
    selectedToppings: IProductOption[];
    selectedAddOns: IProductOption[];
    specialInstructions?: string;
  }) => {
    const sizePrice = params.selectedSize?.price || 0;
    const crustPrice = params.selectedCrust?.price || 0;
    const toppingsPrice = params.selectedToppings.reduce((s, t) => s + t.price, 0);
    const addOnsPrice = params.selectedAddOns.reduce((s, a) => s + a.price, 0);
    const unitPrice = Number(
      (params.product.basePrice + sizePrice + crustPrice + toppingsPrice + addOnsPrice).toFixed(2)
    );

    const signature = JSON.stringify({
      pid: params.product.id,
      sz: params.selectedSize?.name,
      cr: params.selectedCrust?.name,
      tp: params.selectedToppings.map((t) => t.name).sort(),
      ao: params.selectedAddOns.map((a) => a.name).sort(),
      si: params.specialInstructions?.trim() || '',
    });

    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.cartItemId === signature);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + params.quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          lineTotal: Number((unitPrice * newQty).toFixed(2)),
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId: signature,
          product: params.product,
          quantity: params.quantity,
          selectedSize: params.selectedSize,
          selectedCrust: params.selectedCrust,
          selectedToppings: params.selectedToppings,
          selectedAddOns: params.selectedAddOns,
          specialInstructions: params.specialInstructions,
          unitPrice,
          lineTotal: Number((unitPrice * params.quantity).toFixed(2)),
        },
      ];
    });

    pushNotification('Added to Bag', `${params.quantity}× ${params.product.name}`);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: nextQty,
            lineTotal: Number((item.unitPrice * nextQty).toFixed(2)),
          };
        })
        .filter((x): x is CartItem => Boolean(x))
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => setCart([]);

  const reorderPastOrder = (order: IOrder) => {
    const restored: CartItem[] = [];
    for (const item of order.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      restored.push({
        cartItemId: `reorder-${item.productId}-${Math.random()}`,
        product,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedCrust: item.selectedCrust,
        selectedToppings: item.selectedToppings || [],
        selectedAddOns: item.selectedAddOns || [],
        specialInstructions: item.specialInstructions,
        unitPrice: item.itemUnitTotal,
        lineTotal: item.lineTotal,
      });
    }
    if (restored.length > 0) {
      setCart(restored);
      setIsCartOpen(true);
      pushNotification('Order Restored to Bag', `Loaded ${restored.length} items from Order #${order.orderNumber}`);
    }
  };

  return (
    <RestaurantContext.Provider
      value={{
        loading,
        dataMode,
        settings,
        categories,
        products,
        orders,
        inventory,
        suppliers,
        coupons,
        reviews,
        riders,
        user,
        token,
        cart,
        isCartOpen,
        setIsCartOpen,
        notifications,
        dismissNotification,
        pushNotification,
        login,
        register,
        switchRole,
        logout,
        toggleFavorite,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        reorderPastOrder,
        refreshAll,
        apiFetch,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}
