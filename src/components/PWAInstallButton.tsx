import React, { useEffect, useState } from 'react';
import { Smartphone, X, CheckCircle2 } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const OWNER_NOTIFICATION_EMAIL = 'hassam.ansar22007@gmail.com';
const INSTALLED_STORAGE_KEY = 'eo_mobile_app_installed_v1';

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('pwa-prompt-ready'));
  });
}

async function notifyOwnerByEmail(subject: string, data: Record<string, string>) {
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
        ...data,
        Time: new Date().toLocaleString(),
      }),
    });
  } catch {
    // Ignore network error
  }
}

export const PWAInstallButton: React.FC<{ fullWidth?: boolean }> = ({ fullWidth = false }) => {
  const { user, apiFetch, pushNotification } = useRestaurant();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.location.search.includes('standalone=1');
    const savedInstalled = localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true';
    return standalone || savedInstalled;
  });
  const [isIOS, setIsIOS] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const markAppInstalled = () => {
    setIsInstalled(true);
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage error
    }
  };

  const reportInstallToBackend = async (platformLabel: string, isStandalone: boolean) => {
    try {
      await apiFetch('/api/telemetry/app-install', {
        method: 'POST',
        body: JSON.stringify({
          platform: platformLabel,
          userAgent: navigator.userAgent,
          standalone: isStandalone,
          userName: user?.name || 'Customer Mobile Device',
        }),
      });
    } catch {
      // Ignore telemetry error
    }

    await notifyOwnerByEmail(
      `[Ember & Oak] Mobile App Installed (${user?.name || 'Customer'})`,
      {
        Event: 'Mobile App Installed / Opened on Phone',
        Customer_Name: user?.name || 'Guest Customer',
        Customer_Email: user?.email || 'Not signed in',
        Customer_Phone: user?.phone || 'Not provided',
        Platform: platformLabel,
        Device_Browser: navigator.userAgent,
      }
    );
  };

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      markAppInstalled();
      if (!sessionStorage.getItem('eo_pwa_logged')) {
        sessionStorage.setItem('eo_pwa_logged', '1');
        reportInstallToBackend('Installed Mobile Home Screen App', true);
      }
    }

    const displayModeMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        markAppInstalled();
      }
    };
    if (displayModeMedia.addEventListener) {
      displayModeMedia.addEventListener('change', handleDisplayModeChange);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const syncPrompt = () => {
      if (globalDeferredPrompt) {
        setDeferredPrompt(globalDeferredPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(globalDeferredPrompt);
    };

    const handleAppInstalled = () => {
      markAppInstalled();
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setShowGuideModal(false);
      reportInstallToBackend('Android / Chrome Home Screen Install', false);
    };

    window.addEventListener('pwa-prompt-ready', syncPrompt);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (displayModeMedia.removeEventListener) {
        displayModeMedia.removeEventListener('change', handleDisplayModeChange);
      }
      window.removeEventListener('pwa-prompt-ready', syncPrompt);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt || globalDeferredPrompt;
    if (activePrompt) {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        markAppInstalled();
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        await reportInstallToBackend('Chrome / Android Home Screen', false);
        pushNotification('App Installed!', 'Ember & Oak is now installed on your mobile phone.');
      }
      return;
    }
    setShowGuideModal(true);
  };

  // Hide the "Install Mobile App" button completely once the app is installed
  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`${
          fullWidth ? 'w-full justify-center py-2.5' : 'px-3 py-1.5'
        } rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Install Mobile App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-display font-bold">
                  Install Ember &amp; Oak on Your Mobile
                </h3>
              </div>
              <button onClick={() => setShowGuideModal(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-600 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <p className="font-semibold text-stone-900">
                  Android Phone (Chrome / Samsung Internet):
                </p>
                <p>
                  1. Tap the <strong>3-dot menu (⋮)</strong> at the top right of Chrome.<br />
                  2. Tap <strong>“Install app”</strong> or <strong>“Add to Home screen”</strong>.<br />
                  3. Tap <strong>Install</strong> — the app icon will appear on your phone home screen!
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <p className="font-semibold text-stone-900">
                  iPhone / iPad (Safari):
                </p>
                <p>
                  1. Tap the <strong>Share icon (square with arrow ↑)</strong> at the bottom.<br />
                  2. Scroll down and tap <strong>“Add to Home Screen”</strong>.<br />
                  3. Tap <strong>Add</strong> at the top right.
                </p>
              </div>

              {isIOS && (
                <p className="text-amber-700 font-medium">
                  iPhone/iPad detected — follow the Safari steps above to add to your home screen!
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={async () => {
                  markAppInstalled();
                  await reportInstallToBackend('Mobile Device Install Confirmed', false);
                  setShowGuideModal(false);
                  pushNotification('App Installed!', 'Install button is now hidden.');
                }}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                I Installed It (Hide Button)
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2.5 border border-stone-300 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};