import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ShoppingBag, UserCheck, X, LogIn, UserPlus } from 'lucide-react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { CustomerStorefront } from './components/CustomerStorefront';
import { PosTerminal } from './components/PosTerminal';
import { KitchenDisplay } from './components/KitchenDisplay';
import { DeliveryRiderPanel } from './components/DeliveryRiderPanel';
import { AdminDashboard } from './components/AdminDashboard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { UserRole } from './types/restaurant';

const NavigationShell: React.FC = () => {
  const {
    cart,
    setIsCartOpen,
    user,
    login,
    register,
    switchRole,
    logout,
    notifications,
    dismissNotification,
    orders,
  } = useRestaurant();

  const location = useLocation();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'roles' | 'login' | 'register'>('roles');
  const [email, setEmail] = useState('owner@emberandoak.com');
  const [password, setPassword] = useState('password123');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const activeKitchenCount = orders.filter((o) =>
    ['Pending', 'Confirmed', 'Preparing'].includes(o.status)
  ).length;

  const handleRoleSwitchAndNavigate = async (role: UserRole, targetPath: string) => {
    try {
      await switchRole(role);
      setShowAuthModal(false);
      navigate(targetPath);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await login(email, password);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await register(regName, regEmail, regPhone, regPassword);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="text-lg font-display font-bold tracking-tight text-stone-950 whitespace-nowrap shrink-0"
        >
          Ember &amp; Oak
        </Link>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <Link
            to="/"
            className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/' ? 'text-stone-950 underline underline-offset-8 decoration-2 decoration-amber-600' : ''
            }`}
          >
            Storefront
          </Link>
          <Link
            to="/pos"
            className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/pos' ? 'text-stone-950 underline underline-offset-8 decoration-2 decoration-amber-600' : ''
            }`}
          >
            POS Terminal
          </Link>
          <Link
            to="/kitchen"
            className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/kitchen' ? 'text-stone-950 underline underline-offset-8 decoration-2 decoration-amber-600' : ''
            }`}
          >
            Kitchen Display ({activeKitchenCount})
          </Link>
          <Link
            to="/rider"
            className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/rider' ? 'text-stone-950 underline underline-offset-8 decoration-2 decoration-amber-600' : ''
            }`}
          >
            Rider Panel
          </Link>
          <Link
            to="/admin"
            className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/admin' ? 'text-stone-950 underline underline-offset-8 decoration-2 decoration-amber-600' : ''
            }`}
          >
            Admin Console
          </Link>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {location.pathname === '/' ? (
            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-950 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Order Bag ({cartCount})</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-950 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{user ? `${user.role.toUpperCase()} Account` : 'Sign In / Switch Role'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation & Role Context Bar */}
      <div className="bg-stone-900 text-stone-300 px-6 py-2 text-xs border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 overflow-x-auto md:hidden py-1">
          <Link to="/" className="whitespace-nowrap hover:text-white">
            Storefront
          </Link>
          <Link to="/pos" className="whitespace-nowrap hover:text-white">
            POS
          </Link>
          <Link to="/kitchen" className="whitespace-nowrap hover:text-white">
            Kitchen ({activeKitchenCount})
          </Link>
          <Link to="/rider" className="whitespace-nowrap hover:text-white">
            Rider
          </Link>
          <Link to="/admin" className="whitespace-nowrap hover:text-white">
            Admin
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-400">Active Session:</span>
          <strong className="text-white">
            {user ? `${user.name} (${user.role.toUpperCase()})` : 'Guest Session'}
          </strong>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-stone-400 hidden sm:inline">Quick Role Switch:</span>
          {(
            [
              { role: 'customer', label: 'Customer', path: '/' },
              { role: 'cashier', label: 'POS Cashier', path: '/pos' },
              { role: 'kitchen', label: 'Kitchen KDS', path: '/kitchen' },
              { role: 'rider', label: 'Rider', path: '/rider' },
              { role: 'manager', label: 'Manager', path: '/admin' },
              { role: 'owner', label: 'Owner', path: '/admin' },
            ] as const
          ).map((r) => (
            <button
              key={r.role}
              onClick={() => handleRoleSwitchAndNavigate(r.role, r.path)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                user?.role === r.role
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-800 hover:bg-stone-700 text-amber-300 whitespace-nowrap shrink-0"
          >
            Login / Signup
          </button>
          <PWAInstallButton />
        </div>
      </div>

      {/* Main Viewport */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<CustomerStorefront />} />
          <Route path="/pos" element={<PosTerminal />} />
          <Route path="/kitchen" element={<KitchenDisplay />} />
          <Route path="/rider" element={<DeliveryRiderPanel />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="bg-stone-950 text-stone-400 border-t border-stone-800 py-8 px-6 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-white text-sm">Ember &amp; Oak Kitchen</p>
            <p className="text-stone-500 mt-0.5">
              742 Artisan Avenue, Culinary District, NY 10012 · Open Daily 11:00 AM – 11:30 PM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/" className="hover:text-white">
              Customer Storefront
            </Link>
            <Link to="/pos" className="hover:text-white">
              POS System
            </Link>
            <Link to="/kitchen" className="hover:text-white">
              Kitchen Display
            </Link>
            <Link to="/rider" className="hover:text-white">
              Delivery Rider Panel
            </Link>
            <Link to="/admin" className="hover:text-white">
              Admin Dashboard
            </Link>
          </div>
        </div>
      </footer>

      {/* Live Real-Time Toast Notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="pointer-events-auto bg-stone-950 text-white border border-stone-700 rounded-xl p-3.5 shadow-xl flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-xs font-semibold text-amber-400">{n.title}</p>
                <p className="text-xs text-stone-200 mt-0.5">{n.message}</p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Authentication & Role Access Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-display font-bold text-stone-900">
                Authentication &amp; Role-Based Access Control
              </h3>
              <button onClick={() => setShowAuthModal(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                onClick={() => setAuthTab('roles')}
                className={`py-1.5 text-xs font-semibold rounded-md ${
                  authTab === 'roles' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Role Switcher
              </button>
              <button
                onClick={() => setAuthTab('login')}
                className={`py-1.5 text-xs font-semibold rounded-md ${
                  authTab === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Email Sign In
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`py-1.5 text-xs font-semibold rounded-md ${
                  authTab === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            {authTab === 'roles' && (
              <div className="space-y-2.5">
                <p className="text-xs text-stone-600">
                  Select any role below to sign in with a real JWT token and navigate to its dedicated workspace:
                </p>
                {(
                  [
                    {
                      role: 'owner',
                      title: 'Owner (Marcus Vance)',
                      email: 'owner@emberandoak.com',
                      path: '/admin',
                    },
                    {
                      role: 'manager',
                      title: 'Manager (Elena Rostova)',
                      email: 'manager@emberandoak.com',
                      path: '/admin',
                    },
                    {
                      role: 'cashier',
                      title: 'POS Cashier (Devon Brooks)',
                      email: 'cashier@emberandoak.com',
                      path: '/pos',
                    },
                    {
                      role: 'kitchen',
                      title: 'Kitchen Staff (Chef Mateo Silva)',
                      email: 'kitchen@emberandoak.com',
                      path: '/kitchen',
                    },
                    {
                      role: 'rider',
                      title: 'Delivery Rider (Tariq Hassan)',
                      email: 'rider@emberandoak.com',
                      path: '/rider',
                    },
                    {
                      role: 'customer',
                      title: 'Customer (Sophia Chen)',
                      email: 'customer@emberandoak.com',
                      path: '/',
                    },
                  ] as const
                ).map((acct) => (
                  <button
                    key={acct.role}
                    onClick={() => handleRoleSwitchAndNavigate(acct.role, acct.path)}
                    className="w-full p-3 rounded-xl border border-stone-200 hover:border-amber-600 bg-stone-50 flex items-center justify-between text-left text-xs transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-stone-900">{acct.title}</p>
                      <p className="text-[11px] font-mono text-stone-500">{acct.email}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-stone-900 text-white rounded font-semibold">
                      Launch →
                    </span>
                  </button>
                ))}
                {user && (
                  <button
                    onClick={() => {
                      logout();
                      setShowAuthModal(false);
                    }}
                    className="w-full py-2 text-xs text-red-600 font-semibold hover:underline pt-2"
                  >
                    Sign Out (Continue as Guest)
                  </button>
                )}
              </div>
            )}

            {authTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Password (default: password123)
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In with JWT
                </button>
              </form>
            )}

            {authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Account (+100 Loyalty Pts)
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <RestaurantProvider>
      <Router>
        <NavigationShell />
      </Router>
    </RestaurantProvider>
  );
}
