import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Package,
  TrendingUp,
  Settings,
  AlertTriangle,
  Sparkles,
  LogOut,
  Globe,
  Wifi,
  WifiOff,
  Award,
  Star
} from 'lucide-react';
import CustomersModal from './CustomersModal';

export default function Navbar({
  activeTab,
  setActiveTab,
  cartCount = 0,
  lowStockCount = 0,
  settings,
  user,
  onLogout
}) {
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const tabs = [
    { id: 'billing', label: 'POS Billing', icon: ShoppingBag, badge: cartCount > 0 ? cartCount : null, badgeColor: 'bg-indigo-500' },
    { id: 'inventory', label: 'Stock & Inventory', icon: Package, badge: lowStockCount > 0 ? lowStockCount : null, badgeColor: 'bg-amber-500' },
    { id: 'storefront', label: 'Online Store', icon: Globe, badge: 'WhatsApp', badgeColor: 'bg-emerald-600' },
    { id: 'pnl', label: 'Reports & P&L', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-900/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Shop Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 text-white shadow-lg shadow-indigo-500/25 preserve-3d group cursor-pointer">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white m-0">
                  {settings?.shop_name || user?.shop_name || 'MS Store'}
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  POS PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 truncate max-w-[140px] sm:max-w-xs m-0">
                {settings?.tagline || 'Smart Retail & Billing'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{tab.label}</span>

                  {tab.badge !== null && tab.badge !== undefined && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white rounded-full ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Section: Online Status, Loyalty CRM, Low Stock Warning & Owner Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Customer Loyalty CRM Directory Trigger */}
            <button
              type="button"
              onClick={() => setShowLoyaltyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Customer Loyalty CRM & Points Directory"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Loyalty CRM</span>
            </button>

            {/* Live Online / Offline Mode Badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
              }`}
              title={isOnline ? 'Connected to Cloud PostgreSQL' : 'Offline Mode: Zero-Lag Local Billing Active'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {lowStockCount > 0 && (
              <div
                onClick={() => setActiveTab('inventory')}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium cursor-pointer hover:bg-amber-500/20 transition"
                title="Click to view low stock items"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lowStockCount} items low!</span>
              </div>
            )}

            {/* Owner Email ID Profile Chip with Log Out Button */}
            {user?.email && (
              <div className="flex items-center gap-2 p-1 pl-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80">
                <div className="flex items-center gap-2 max-w-[120px] sm:max-w-[180px]">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(user.name || user.email || 'O')[0].toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-200 truncate m-0 leading-tight">
                      {user.name || 'Store Owner'}
                    </p>
                    <p className="text-[10px] text-indigo-400 truncate m-0 leading-tight">
                      {user.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Log Out of this Account"
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-rose-600 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loyalty Members CRM Modal */}
      {showLoyaltyModal && (
        <CustomersModal
          settings={settings}
          onClose={() => setShowLoyaltyModal(false)}
        />
      )}
    </header>
  );
}
