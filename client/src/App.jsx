import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import BillingView from './views/BillingView';
import InventoryView from './views/InventoryView';
import ProfitLossView from './views/ProfitLossView';
import SettingsView from './views/SettingsView';
import StorefrontView from './views/StorefrontView';
import CustomerDisplayView from './views/CustomerDisplayView';
import AuthModal from './components/AuthModal';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import DailyClosingDigestModal from './components/DailyClosingDigestModal';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'inventory', 'pnl', 'settings'
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(() => api.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [showClosingReminder, setShowClosingReminder] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);

  // Fetch all initial store data from backend for the logged-in user
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = api.getCurrentUser();
      setUser(currentUser);

      if (!currentUser?.email) {
        setLoading(false);
        return;
      }

      const [settingsData, productsData, categoriesData] = await Promise.all([
        api.getSettings(),
        api.getProducts(),
        api.getCategories(),
      ]);
      setSettings(settingsData);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load store data from backend:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to refresh products:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Automated daily closing WhatsApp reminder check (checks every 30s)
  useEffect(() => {
    const checkClosingReminder = () => {
      try {
        const enabled = localStorage.getItem('ms_store_auto_closing_enabled');
        if (enabled === 'false') return;
        const targetTime = localStorage.getItem('ms_store_auto_closing_time') || '21:30';
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const lastAlert = localStorage.getItem('ms_store_last_closing_alert');
        if (lastAlert === todayKey) return;

        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMins = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${currentHours}:${currentMins}`;

        if (currentTime >= targetTime) {
          setShowClosingReminder(true);
        }
      } catch {}
    };

    checkClosingReminder();
    const interval = setInterval(checkClosingReminder, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenClosingModal = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      localStorage.setItem('ms_store_last_closing_alert', todayKey);
    } catch {}
    setShowClosingReminder(false);
    setShowClosingModal(true);
  };

  const handleDismissClosingReminder = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      localStorage.setItem('ms_store_last_closing_alert', todayKey);
    } catch {}
    setShowClosingReminder(false);
  };

  // When user signs up or logs in
  const handleAuthenticated = async (userSession) => {
    setUser(userSession);
    await loadInitialData();
  };

  // When user logs out
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setProducts([]);
    setCategories([]);
    setSettings(null);
  };

  // Count low stock items for navbar warning badge
  const lowStockCount = products.filter(
    (p) => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0
  ).length;

  if (loading && user && !settings) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide">Connecting to MS Store Cloud Backend...</p>
      </div>
    );
  }

  // Check if opening customer-facing secondary display
  const isCustomerDisplay = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('view') === 'customer-display';
    } catch {
      return false;
    }
  })();

  if (isCustomerDisplay) {
    return <CustomerDisplayView settings={settings} />;
  }

  // Check if visitor is accessing public storefront catalog link
  const isPublicStore = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('view') === 'catalog' || p.has('store');
    } catch {
      return false;
    }
  })();

  if (isPublicStore) {
    return (
      <StorefrontView
        settings={settings}
        products={products}
        user={user}
        isPreview={false}
      />
    );
  }

  // If user is not logged in, show Sign Up / Log In Modal
  if (!user?.email) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        <AuthModal onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Sticky Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        settings={settings}
        user={user}
        onLogout={handleLogout}
      />

      {/* Offline Mode & Cloud Sync Banner (Feature #8) */}
      <OfflineSyncBanner onSyncComplete={refreshProducts} />

      {/* Automated Daily Closing WhatsApp Prompt Banner (Feature #7) */}
      {showClosingReminder && (
        <aside aria-label="Store Closing Alert" className="no-print bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-b border-emerald-500/50 text-white px-4 py-2.5 shadow-xl animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-300">
                <span className="text-base">🔔</span>
              </div>
              <div>
                <strong className="text-emerald-300 font-bold">Daily Closing Time!</strong>{' '}
                <span className="text-slate-300">
                  Today's executive store summary is ready. Send the daily revenue & profit report directly to your WhatsApp.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenClosingModal}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 transition cursor-pointer"
              >
                Send WhatsApp Digest
              </button>
              <button
                type="button"
                onClick={handleDismissClosingReminder}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs rounded hover:bg-slate-800 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Tab View Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'billing' && (
          <BillingView
            products={products}
            categories={categories}
            settings={settings}
            refreshProducts={refreshProducts}
            onOrderCompleted={refreshProducts}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            categories={categories}
            settings={settings}
            refreshProducts={refreshProducts}
          />
        )}

        {activeTab === 'storefront' && (
          <StorefrontView
            settings={settings}
            products={products}
            user={user}
            isPreview={true}
          />
        )}

        {activeTab === 'pnl' && (
          <ProfitLossView
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSettingsUpdated={(newSettings) => setSettings(newSettings)}
            user={user}
            onResetData={loadInitialData}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-800/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="m-0">
            {settings?.shop_name || user?.shop_name || 'MS Store'} • POS, Stock & Profit/Loss Management
          </p>
          <p className="m-0 text-[11px] text-slate-400">
            Logged in as: <span className="text-indigo-400 font-mono font-semibold">{user.email}</span>
          </p>
        </div>
      </footer>

      {/* Automated Closing Reminder Modal */}
      {showClosingModal && (
        <DailyClosingDigestModal
          settings={settings}
          user={user}
          onClose={() => setShowClosingModal(false)}
        />
      )}
    </div>
  );
}
