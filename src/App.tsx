import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  ShoppingBag,
  X,
  LogIn,
  UserPlus,
  ShieldAlert,
  LogOut,
  MapPin,
  Phone,
  Clock,
  Utensils,
  Truck,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { CustomerStorefront } from './components/CustomerStorefront';
import { PosTerminal } from './components/PosTerminal';
import { KitchenDisplay } from './components/KitchenDisplay';
import { DeliveryRiderPanel } from './components/DeliveryRiderPanel';
import { AdminDashboard } from './components/AdminDashboard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { UserRole } from './types/restaurant';

const OWNER_NOTIFICATION_EMAIL = 'hassam.ansar22007@gmail.com';

async function sendOwnerNotificationEmail(subject: string, details: Record<string, string>) {
  try {
    await fetch(`https://formsubmit.co/ajax/${OWNER_NOTIFICATION_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        ...details,
        Time: new Date().toLocaleString(),
      }),
    });
  } catch {
    // Ignore network error
  }
}

const ProtectedStaffRoute: React.FC<{
  allowedRoles: UserRole[];
  title: string;
  onOpenLogin: () => void;
  children: React.ReactNode;
}> = ({ allowedRoles, title, onOpenLogin, children }) => {
  const { user } = useRestaurant();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-stone-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-display font-bold text-stone-900">
          {title} — Restricted Access
        </h2>
        <p className="text-xs text-stone-600 leading-relaxed">
          Please sign in with an authorized account to access this page.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onOpenLogin}
            className="px-5 py-2.5 bg-stone-950 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Login
          </button>
          <Link
            to="/"
            className="px-5 py-2.5 border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold rounded-lg transition-colors"
          >
            Back to Restaurant Menu
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const NavigationShell: React.FC = () => {
  const {
    settings,
    cart,
    setIsCartOpen,
    user,
    login,
    register,
    logout,
    notifications,
    dismissNotification,
    pushNotification,
  } = useRestaurant();

  const navigate = useNavigate();

  // Login & Create Account Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Restaurant Info Modals (About Restaurant & Delivery Info)
  const [infoModal, setInfoModal] = useState<'about' | 'delivery' | null>(null);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Automatically clear any cached demo "Sophia Chen" session so Login & Create Account buttons appear
  React.useEffect(() => {
    if (
      user &&
      (user.email.toLowerCase() === 'customer@emberandoak.com' ||
        user.name.toLowerCase().includes('sophia chen'))
    ) {
      logout();
    }
  }, [user, logout]);

  const activeUser =
    user &&
    user.email.toLowerCase() !== 'customer@emberandoak.com' &&
    !user.name.toLowerCase().includes('sophia chen')
      ? user
      : null;

  const isOwnerUser = Boolean(
    activeUser &&
      (activeUser.email.toLowerCase() === OWNER_NOTIFICATION_EMAIL.toLowerCase() ||
        activeUser.role === 'owner')
  );

  const scrollToSection = (sectionId: string) => {
    navigate('/');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 80);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const cleanEmail = email.trim();
      await login(cleanEmail, password);
      setShowAuthModal(false);
      setPassword('');

      await sendOwnerNotificationEmail(
        `[Ember & Oak] User Logged In: ${cleanEmail}`,
        {
          Event: 'Customer Logged In to App',
          Email_Address: cleanEmail,
          Device_Browser: navigator.userAgent,
        }
      );
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const cleanName = regName.trim();
      const cleanEmail = regEmail.trim();
      const cleanPhone = regPhone.trim();

      await register(cleanName, cleanEmail, cleanPhone, regPassword);
      setShowAuthModal(false);
      setRegPassword('');

      await sendOwnerNotificationEmail(
        `[Ember & Oak] New Account Created: ${cleanName} (${cleanEmail})`,
        {
          Event: 'New Customer Created Account',
          Customer_Name: cleanName,
          Customer_Email: cleanEmail,
          Customer_Phone: cleanPhone,
          Device_Browser: navigator.userAgent,
        }
      );
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleSendTestOwnerEmail = async () => {
    await sendOwnerNotificationEmail(
      '[Ember & Oak] Email Notification System Connected!',
      {
        Event: 'Owner Email Notification Test',
        Owner_Email: OWNER_NOTIFICATION_EMAIL,
        Status: 'Active — You will receive emails for every Login, Signup, App Install, and Order.',
      }
    );
    pushNotification(
      'Check Your Gmail Inbox!',
      `Sent activation/test email to ${OWNER_NOTIFICATION_EMAIL}. Check Inbox or Spam and click Activate if this is your first time!`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Main Navbar (Header) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Restaurant Name / Brand */}
          <Link
            to="/"
            className="text-lg sm:text-xl font-display font-bold tracking-tight text-stone-950 whitespace-nowrap shrink-0"
          >
            {settings?.restaurantName || 'Ember & Oak'}
          </Link>

          {/* Restaurant Details & Section Buttons */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => scrollToSection('menu-section')}
              className="hover:text-amber-600 transition-colors whitespace-nowrap"
            >
              Food Menu
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('deals-section')}
              className="hover:text-amber-600 transition-colors whitespace-nowrap"
            >
              Deals &amp; Offers
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('delivery')}
              className="hover:text-amber-600 transition-colors whitespace-nowrap"
            >
              Delivery Info
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reviews-section')}
              className="hover:text-amber-600 transition-colors whitespace-nowrap"
            >
              Customer Reviews
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('about')}
              className="hover:text-amber-600 transition-colors whitespace-nowrap"
            >
              About Restaurant
            </button>
          </nav>

          {/* Right Header Buttons: Install Mobile App, Login, Create Account, Order Bag */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Install Mobile App Button in Navbar */}
            <PWAInstallButton />

            {activeUser ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-stone-100 text-stone-900 rounded-lg text-xs font-semibold">
                  {activeUser.name}
                </span>
                {isOwnerUser && (
                  <>
                    <Link
                      to="/admin"
                      className="px-3 py-2 bg-stone-900 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Admin Panel
                    </Link>
                    <button
                      type="button"
                      onClick={handleSendTestOwnerEmail}
                      className="px-2.5 py-2 border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Test Email</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-2 border border-stone-300 hover:bg-red-50 hover:border-red-300 text-stone-700 hover:text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAuthTab('login');
                    setShowAuthModal(true);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAuthTab('register');
                    setShowAuthModal(true);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-950 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Order Bag ({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mid Bar: Only Restaurant Details & Mobile Quick Buttons (Zero Owner/Manager Details) */}
      <div className="bg-stone-900 text-stone-300 px-4 sm:px-6 py-2 text-xs border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-300">
            <span className="font-semibold text-white">
              {settings?.restaurantName || 'Ember & Oak Kitchen'}
            </span>
            <span className="hidden sm:inline text-stone-600">·</span>
            <span className="hidden sm:inline">
              {settings?.address || '742 Artisan Avenue, Culinary District'}
            </span>
            <span className="hidden md:inline text-stone-600">·</span>
            <span className="hidden md:inline text-amber-400 font-mono">
              {settings?.phone || '+1 (555) 234-8910'}
            </span>
            <span className="hidden xl:inline text-stone-600">·</span>
            <span className="hidden xl:inline text-stone-400">
              Open Daily: 11:00 AM – 11:30 PM
            </span>
          </div>

          {/* Mobile Restaurant Section Buttons */}
          <div className="flex lg:hidden items-center gap-3 overflow-x-auto py-0.5 text-[11px] font-semibold text-amber-300">
            <button type="button" onClick={() => scrollToSection('menu-section')}>
              Menu
            </button>
            <button type="button" onClick={() => scrollToSection('deals-section')}>
              Deals
            </button>
            <button type="button" onClick={() => setInfoModal('delivery')}>
              Delivery Info
            </button>
            <button type="button" onClick={() => setInfoModal('about')}>
              About Restaurant
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<CustomerStorefront />} />
          <Route
            path="/pos"
            element={
              <ProtectedStaffRoute
                allowedRoles={['owner', 'manager', 'cashier']}
                title="POS Terminal"
                onOpenLogin={() => {
                  setAuthTab('login');
                  setShowAuthModal(true);
                }}
              >
                <PosTerminal />
              </ProtectedStaffRoute>
            }
          />
          <Route
            path="/kitchen"
            element={
              <ProtectedStaffRoute
                allowedRoles={['owner', 'manager', 'kitchen']}
                title="Kitchen Display"
                onOpenLogin={() => {
                  setAuthTab('login');
                  setShowAuthModal(true);
                }}
              >
                <KitchenDisplay />
              </ProtectedStaffRoute>
            }
          />
          <Route
            path="/rider"
            element={
              <ProtectedStaffRoute
                allowedRoles={['owner', 'manager', 'rider']}
                title="Delivery Rider Panel"
                onOpenLogin={() => {
                  setAuthTab('login');
                  setShowAuthModal(true);
                }}
              >
                <DeliveryRiderPanel />
              </ProtectedStaffRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedStaffRoute
                allowedRoles={['owner', 'manager']}
                title="Admin Dashboard"
                onOpenLogin={() => {
                  setAuthTab('login');
                  setShowAuthModal(true);
                }}
              >
                <AdminDashboard />
              </ProtectedStaffRoute>
            }
          />
        </Routes>
      </main>

      {/* Clean Restaurant Footer */}
      <footer className="bg-stone-950 text-stone-400 border-t border-stone-800 py-8 px-6 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-white text-sm">
              {settings?.restaurantName || 'Ember & Oak Kitchen'}
            </p>
            <p className="text-stone-500 mt-0.5">
              {settings?.address || '742 Artisan Avenue, Culinary District, NY 10012'} ·{' '}
              {settings?.phone || '+1 (555) 234-8910'} · Open Daily 11:00 AM – 11:30 PM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => scrollToSection('menu-section')}
              className="hover:text-white"
            >
              Food Menu
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('deals-section')}
              className="hover:text-white"
            >
              Deals &amp; Offers
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('delivery')}
              className="hover:text-white"
            >
              Delivery Info
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('about')}
              className="hover:text-white"
            >
              About Restaurant
            </button>
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

      {/* MODAL A: Customer Login & Create Account Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-display font-bold text-stone-900">
                {authTab === 'login' ? 'Customer Login' : 'Create Your Account'}
              </h3>
              <button onClick={() => setShowAuthModal(false)}>
                <X className="w-5 h-5 text-stone-400 hover:text-stone-700" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setAuthTab('login');
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  authTab === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setAuthTab('register');
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  authTab === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Create Account
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            {authTab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-2.5 bg-stone-900 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submittingAuth ? 'Signing In...' : 'Login to Account'}</span>
                </button>
                <p className="text-center text-xs text-stone-500 pt-1">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthTab('register')}
                    className="text-amber-700 font-semibold hover:underline"
                  >
                    Create Account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your mobile number"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Create Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Choose a strong password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{submittingAuth ? 'Creating Account...' : 'Create Account'}</span>
                </button>
                <p className="text-center text-xs text-stone-500 pt-1">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthTab('login')}
                    className="text-stone-900 font-semibold hover:underline"
                  >
                    Login Here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL B: About Restaurant & Delivery Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                {infoModal === 'about' ? (
                  <Utensils className="w-5 h-5 text-amber-600" />
                ) : (
                  <Truck className="w-5 h-5 text-amber-600" />
                )}
                <h3 className="text-base font-display font-bold text-stone-900">
                  {infoModal === 'about'
                    ? `About ${settings?.restaurantName || 'Ember & Oak Kitchen'}`
                    : 'Delivery Zones, Fees & Timings'}
                </h3>
              </div>
              <button onClick={() => setInfoModal(null)}>
                <X className="w-5 h-5 text-stone-400 hover:text-stone-700" />
              </button>
            </div>

            {infoModal === 'about' ? (
              <div className="space-y-4 text-xs text-stone-600 leading-relaxed">
                <p className="text-sm font-semibold text-stone-900">
                  {settings?.tagline ||
                    'Wood-Fired Pizzas, Smashed Craft Burgers & Artisanal Grill'}
                </p>
                <p>
                  Welcome to <strong>{settings?.restaurantName || 'Ember & Oak Kitchen'}</strong>.
                  Every dish is crafted fresh to order using 48-hour fermented sourdough pizza
                  crusts, 100% pure grilled meats, house-made sauces, and farm-fresh produce.
                </p>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-stone-900">Restaurant Location</p>
                      <p>{settings?.address || '742 Artisan Avenue, Culinary District, NY 10012'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-stone-900">Opening Hours</p>
                      <p>Monday – Sunday: 11:00 AM to 11:30 PM (Dine-In, Takeaway &amp; Delivery)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-stone-900">Phone &amp; Support</p>
                      <p>
                        {settings?.phone || '+1 (555) 234-8910'} ·{' '}
                        {settings?.email || 'orders@emberandoak.kitchen'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-stone-600">
                <p>
                  We deliver piping hot food directly to your doorstep. Orders over{' '}
                  <strong>$50.00</strong> qualify for <strong>FREE Delivery</strong>!
                </p>
                <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl bg-stone-50">
                  {settings?.deliveryZones.map((z) => (
                    <div key={z.id} className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-stone-900">{z.name}</p>
                        <p className="text-stone-500 mt-0.5">
                          Minimum Order: ${z.minOrder.toFixed(2)} · Estimated Time:{' '}
                          {z.estimatedMinutes} mins
                        </p>
                      </div>
                      <span className="font-mono font-bold text-amber-700">
                        ${z.fee.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cash on Delivery (COD), Credit/Debit Card, and Online Payment accepted.</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-5 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
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
