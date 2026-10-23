import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Store,
  Phone,
  MapPin,
  Percent,
  Mail,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  RotateCcw,
  LogOut,
  Receipt,
  Lock,
  Eye,
  EyeOff,
  Download,
  Upload,
  QrCode,
  Database,
  FileJson,
  MessageSquare,
  Send,
  Wifi,
  WifiOff,
  RefreshCw,
  Star,
  Award,
  Sparkles
} from 'lucide-react';
import DailyClosingDigestModal from '../components/DailyClosingDigestModal';
import CustomersModal from '../components/CustomersModal';
import { api } from '../services/api';

export default function SettingsView({ settings, onSettingsUpdated, user, onResetData, onLogout }) {
  const [formData, setFormData] = useState({
    shop_name: 'MS Store',
    tagline: 'Smart Retail & Inventory Management',
    phone: '',
    address: '',
    currency_symbol: '₹',
    tax_percentage: 5.0,
    upi_id: '',
    loyalty_enabled: true,
    loyalty_points_per_100: 1,
    loyalty_point_value: 1.0,
    loyalty_min_points_to_redeem: 5,
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);

  // Daily Closing Digest & Offline Sync State
  const [showDailyClosingModal, setShowDailyClosingModal] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);

  useEffect(() => {
    api.getPendingOfflineCount().then(setOfflinePendingCount).catch(() => {});
  }, []);

  const handleSyncOffline = async () => {
    try {
      setSyncingOffline(true);
      const res = await api.syncPendingOrders();
      const count = await api.getPendingOfflineCount();
      setOfflinePendingCount(count);
      alert(`Sync completed: ${res.synced} offline sales synced to Supabase PostgreSQL database!`);
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Backup & Restore State
  const [exportingBackup, setExportingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  // Danger zone state
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  const [clearingBills, setClearingBills] = useState(false);
  const [showClearBillsConfirm, setShowClearBillsConfirm] = useState(false);
  const [clearBillsPassword, setClearBillsPassword] = useState('');
  const [showClearBillsPassword, setShowClearBillsPassword] = useState(false);
  const [clearBillsError, setClearBillsError] = useState('');
  const [billClearSuccess, setBillClearSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        shop_name: settings.shop_name || user?.shop_name || 'MS Store',
        tagline: settings.tagline || '',
        phone: settings.phone || user?.phone || '',
        address: settings.address || '',
        currency_symbol: settings.currency_symbol || '₹',
        tax_percentage: settings.tax_percentage ?? 5.0,
        upi_id: settings.upi_id || '',
        loyalty_enabled: settings.loyalty_enabled !== false,
        loyalty_points_per_100: settings.loyalty_points_per_100 !== undefined ? settings.loyalty_points_per_100 : 1,
        loyalty_point_value: settings.loyalty_point_value !== undefined ? settings.loyalty_point_value : 1.0,
        loyalty_min_points_to_redeem: settings.loyalty_min_points_to_redeem !== undefined ? settings.loyalty_min_points_to_redeem : 5,
      });
    }
  }, [settings, user]);

  const handleDownloadBackup = async () => {
    try {
      setExportingBackup(true);
      setBackupMessage('');
      const [prods, orders, stg] = await Promise.all([
        api.getProducts(),
        api.getOrders({ limit: 1000 }),
        api.getSettings(),
      ]);

      const backupObj = {
        app: 'MS Store POS',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        user_email: user?.email,
        settings: stg,
        products: prods,
        orders: orders,
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ms_store_backup_${user?.email ? user.email.replace(/[@.]/g, '_') : 'shop'}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMessage('Backup file downloaded successfully!');
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setExportingBackup(false);
    }
  };

  const handleFileRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Restore store data from "${file.name}"? This will import products from the backup file.`)) {
      e.target.value = '';
      return;
    }

    try {
      setRestoringBackup(true);
      setBackupMessage('');
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.products || !Array.isArray(parsed.products)) {
        throw new Error('Invalid backup file. Missing products array.');
      }

      let restoredCount = 0;
      for (const prod of parsed.products) {
        try {
          await api.createProduct({
            name: prod.name,
            sku: prod.sku,
            category: prod.category || 'General',
            cost_price: parseFloat(prod.cost_price) || 0,
            selling_price: parseFloat(prod.selling_price) || 0,
            stock_quantity: parseInt(prod.stock_quantity) || 0,
            low_stock_threshold: parseInt(prod.low_stock_threshold) || 5,
            unit: prod.unit || 'pcs',
            gst_percentage: prod.gst_percentage !== undefined ? parseFloat(prod.gst_percentage) : 5,
          });
          restoredCount++;
        } catch {}
      }

      setBackupMessage(`Successfully restored ${restoredCount} products from backup!`);
      if (onResetData) onResetData();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoringBackup(false);
      e.target.value = '';
    }
  };

  const handleSubmitSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings(formData);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearBillHistoryAlone = async (e) => {
    if (e) e.preventDefault();
    if (!clearBillsPassword.trim()) {
      setClearBillsError('Please enter your account password.');
      return;
    }

    try {
      setClearingBills(true);
      setClearBillsError('');
      await api.clearBillHistory(clearBillsPassword.trim());
      setShowClearBillsConfirm(false);
      setClearBillsPassword('');
      setBillClearSuccess(true);
      setTimeout(() => setBillClearSuccess(false), 4000);
      alert('Bill history deleted successfully! All past invoice records and sales data have been cleared. Your product catalog is completely safe.');
    } catch (err) {
      console.error('Failed to clear bill history:', err);
      setClearBillsError(err.message || 'Incorrect password or failed to delete bill history.');
    } finally {
      setClearingBills(false);
    }
  };

  const handleResetAllData = async (e) => {
    if (e) e.preventDefault();
    if (!resetPassword.trim()) {
      setResetError('Please enter your account password.');
      return;
    }

    try {
      setResetting(true);
      setResetError('');
      await api.clearAllData(resetPassword.trim());
      if (onResetData) await onResetData();
      setShowResetConfirm(false);
      setResetPassword('');
      alert('All products and sales data for your ID have been wiped clean. Your store is now starting 100% fresh!');
    } catch (err) {
      console.error('Failed to reset store data:', err);
      setResetError(err.message || 'Incorrect password or failed to reset store data.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Logged-in Account ID Card */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-600/30">
              {(user?.name || user?.email || 'M')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white m-0">{user?.name || 'Store Owner'}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ACTIVE ID
                </span>
              </div>
              <p className="text-xs text-indigo-400 flex items-center gap-1.5 mt-0.5 m-0 font-mono">
                <Mail className="w-3.5 h-3.5" />
                <span>{user?.email || 'No email attached'}</span>
              </p>
              <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                Shop: {user?.shop_name || settings?.shop_name || 'MS Store'} {user?.phone && `• ${user.phone}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2.5 bg-slate-800 hover:bg-rose-600/80 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch Account / Log Out</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-indigo-400" />
          <span>
            All your products, invoices, and reports are saved under <strong className="text-white">{user?.email}</strong>. Logging in with this email ID from any device loads your store data.
          </span>
        </div>
      </div>

      {/* 2. Shop & POS Configuration */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white m-0">Store Details & Billing Settings</h2>
            <p className="text-xs text-slate-400 m-0">
              Shop branding, address for printed invoice receipts, and taxation defaults
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Store settings saved successfully! Your receipts and POS have been updated.</span>
          </div>
        )}

        <form noValidate onSubmit={handleSubmitSettings} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shop Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shop / Business Name *
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Store Tagline / Slogan
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contact Phone / WhatsApp *
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Currency Symbol */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Currency Symbol *
              </label>
              <div className="flex gap-2">
                {['₹', '$', '€', '£', 'AED', '¥'].map((sym) => (
                  <button
                    type="button"
                    key={sym}
                    onClick={() => setFormData({ ...formData, currency_symbol: sym })}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition ${
                      formData.currency_symbol === sym
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Shop Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Store Address (Printed on Bills)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tax Percentage & Merchant UPI VPA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Tax / GST Rate (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={formData.tax_percentage}
                  onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Merchant UPI ID (for Dynamic QR Code)
              </label>
              <div className="relative">
                <QrCode className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. 9876543210@paytm, myshop@okaxis"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Customer Loyalty Points & Cashback Wallet Configuration */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white m-0 flex items-center gap-2">
                    Customer Loyalty Points & WhatsApp CRM
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      REWARDS
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 m-0">
                    Reward repeat customers with points, instant POS checkout redemption, and digital WhatsApp bills
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCustomersModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>View Member CRM Directory</span>
              </button>
            </div>

            {/* Loyalty Program Active Switch */}
            <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Enable Loyalty Points Program</span>
                <span className="text-[11px] text-slate-400 block">
                  Automatically tracks customer visits, calculates earned points, and allows redemption during billing
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.loyalty_enabled}
                  onChange={(e) => setFormData({ ...formData, loyalty_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {formData.loyalty_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Points Earned Per 100 spent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Points Earned per {formData.currency_symbol}100
                  </label>
                  <div className="relative">
                    <Star className="absolute left-3.5 top-3 w-4 h-4 text-amber-500" />
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={formData.loyalty_points_per_100}
                      onChange={(e) => setFormData({ ...formData, loyalty_points_per_100: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    e.g. 1 pt for every {formData.currency_symbol}100 spent
                  </span>
                </div>

                {/* Point Value in Currency */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Point Value ({formData.currency_symbol} per pt)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={formData.loyalty_point_value}
                    onChange={(e) => setFormData({ ...formData, loyalty_point_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    1 pt = {formData.currency_symbol}{formData.loyalty_point_value || 1} discount at checkout
                  </span>
                </div>

                {/* Min Points to Redeem */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Min Points to Redeem
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.loyalty_min_points_to_redeem}
                    onChange={(e) => setFormData({ ...formData, loyalty_min_points_to_redeem: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Customer needs {formData.loyalty_min_points_to_redeem} pts before redeeming
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Settings */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition transform active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Store Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Automated Daily Closing WhatsApp Summary Digest */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white m-0">Automated Daily Closing WhatsApp Summary</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  FEATURE #7
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Generate an executive end-of-day digest sent directly to the store owner's WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDailyClosingModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition transform active:scale-95 self-start sm:self-auto cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Daily Close</span>
          </button>
        </div>

        {/* Digest Preview Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0b141a] border border-emerald-900/40 rounded-2xl p-4 text-xs font-mono space-y-2 text-emerald-200">
            <div className="text-emerald-400 font-bold border-b border-emerald-800/40 pb-1">
              📊 Sample WhatsApp Closing Digest
            </div>
            <p className="m-0 text-white font-semibold">
              💰 Total Revenue: ₹48,250 (Cash: ₹22,100 | UPI: ₹26,150)
            </p>
            <p className="m-0 text-emerald-300">
              📈 Net Profit: ₹11,400 (Margin: 23.6%)
            </p>
            <p className="m-0 text-slate-300">
              🛒 Total Bills: 64 Invoices
            </p>
            <p className="m-0 text-amber-300">
              🥇 Top Item: Amul Butter 100g (38 pcs)
            </p>
            <p className="m-0 text-rose-300">
              ⚠️ Low Stock Alert: 4 items need reordering
            </p>
          </div>

          <div className="flex flex-col justify-between p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-xs text-slate-300 space-y-3">
            <div>
              <span className="font-bold text-white block mb-1">Why this matters:</span>
              <p className="text-slate-400 m-0 leading-relaxed text-[11px]">
                The store owner can monitor daily store performance from anywhere without logging into the computer. Check revenue breakdowns (Cash vs. UPI), net margins, invoice count, top items sold, and low-stock alerts with a single tap.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDailyClosingModal(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Preview & Send Today's Closing Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Full Offline-First Mode & Sync Management */}
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white m-0">Full Offline-First Mode & PWA Sync</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  FEATURE #8
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Zero-downtime IndexedDB catalog caching, local stock deductions, and auto-sync background queue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncOffline}
            disabled={syncingOffline || offlinePendingCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition transform active:scale-95 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncingOffline ? 'animate-spin' : ''}`} />
            <span>{syncingOffline ? 'Syncing...' : 'Sync Queued Sales Now'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-1">
            <span className="text-slate-400 block text-[11px]">IndexedDB Cache Status</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active & Synced
            </span>
            <span className="text-[11px] text-slate-400 block pt-1">
              Catalog and price lists are stored locally in the browser
            </span>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-1">
            <span className="text-slate-400 block text-[11px]">Pending Offline Invoices</span>
            <span className="font-bold text-amber-400 text-sm font-mono">
              {offlinePendingCount} {offlinePendingCount === 1 ? 'sale' : 'sales'} queued
            </span>
            <span className="text-[11px] text-slate-400 block pt-1">
              Sales placed during network drops waiting to sync to PostgreSQL
            </span>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-1">
            <span className="text-slate-400 block text-[11px]">PWA Service Worker</span>
            <span className="font-bold text-indigo-400 text-sm">
              Registered (v1.0.0)
            </span>
            <span className="text-[11px] text-slate-400 block pt-1">
              Works 100% standalone on tablets, laptops, and mobile devices
            </span>
          </div>
        </div>
      </div>

      {/* 5. 1-Click Local & Cloud Backup / Restore */}
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white m-0">1-Click Local & Cloud Backup / Restore</h2>
            <p className="text-xs text-slate-400 m-0">
              Download your entire catalog, settings, and orders into an offline JSON backup file, or restore from a previous snapshot.
            </p>
          </div>
        </div>

        {backupMessage && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{backupMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Download Snapshot */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-1">
                <Download className="w-4 h-4" />
                <span>Export Full Store Backup</span>
              </div>
              <p className="text-xs text-slate-400 m-0">
                Exports all your products, categories, past invoices, and store configurations into a safe portable JSON file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={exportingBackup}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exportingBackup ? 'Creating Backup...' : 'Download JSON Backup'}</span>
            </button>
          </div>

          {/* Restore Snapshot */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                <Upload className="w-4 h-4" />
                <span>Restore from JSON Backup</span>
              </div>
              <p className="text-xs text-slate-400 m-0">
                Upload a previously saved <code className="text-emerald-400 font-mono">ms_store_backup_*.json</code> file to restore catalog items.
              </p>
            </div>
            <label className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload className="w-4 h-4" />
              <span>{restoringBackup ? 'Restoring Data...' : 'Select Backup File'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                disabled={restoringBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Delete Bill History Alone (Preserves Product Inventory) */}
      <div className="bg-slate-900/90 border border-amber-900/40 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-amber-950/60">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white m-0">Delete Bill History Alone</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Safe for Inventory
              </span>
            </div>
            <p className="text-xs text-slate-400 m-0">
              Clear all past billing invoices and sales transactions while keeping all products intact
            </p>
          </div>
        </div>

        {billClearSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Bill history deleted successfully! All past invoices and sales records are cleared. Your product catalog is intact.</span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <p className="text-xs text-slate-300 m-0">
            Want to start your sales calculations fresh without losing any inventory? This action deletes all past order records, printed receipts, and sales revenue history for <strong className="text-white">{user?.email}</strong>. 
            <span className="block mt-1 text-emerald-400 font-medium">✓ Your products, stock counts, categories, and shop settings will NOT be touched.</span>
          </p>

          {!showClearBillsConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearBillsConfirm(true)}
              className="px-5 py-2.5 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 active:scale-95 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Bill History Alone</span>
            </button>
          ) : (
            <form onSubmit={handleClearBillHistoryAlone} className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/50 space-y-3">
              <p className="text-xs font-bold text-amber-300 m-0 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Are you sure you want to delete all bill history? (Product inventory will be preserved)
              </p>

              {clearBillsError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{clearBillsError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Enter Account Password to Confirm:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showClearBillsPassword ? 'text' : 'password'}
                    value={clearBillsPassword}
                    onChange={(e) => setClearBillsPassword(e.target.value)}
                    placeholder="Enter your account password"
                    autoFocus
                    required
                    className="w-full pl-9 pr-10 py-2 bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-white text-xs outline-none transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClearBillsPassword(!showClearBillsPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  >
                    {showClearBillsPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={clearingBills || !clearBillsPassword}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-600/30 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{clearingBills ? 'Deleting Bills...' : 'Yes, Delete Bill History Alone'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClearBillsConfirm(false);
                    setClearBillsPassword('');
                    setClearBillsError('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 4. Danger Zone: Factory Reset / Start Fresh (Zero Dummy Data) */}
      <div className="bg-slate-900/90 border border-rose-900/50 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-rose-950/80">
          <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-rose-400 m-0">Reset Store / Start Fresh</h2>
            <p className="text-xs text-slate-400 m-0">
              Clear all inventory products, order transactions, and stock logs for this account
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-xs text-slate-300 m-0">
            Need to wipe everything including products? This action wipes all sales history and inventory items under your ID (<strong className="text-white">{user?.email}</strong>) so you can begin adding your real products and records from scratch.
          </p>

          {!showResetConfirm ? (
            <button
              type="button"
              onClick={() => {
                setShowResetConfirm(true);
                setResetPassword('');
                setResetError('');
              }}
              className="px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 active:scale-95 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Wipe Store Data & Start Fresh</span>
            </button>
          ) : (
            <form onSubmit={handleResetAllData} className="p-4 rounded-2xl bg-rose-950/40 border border-rose-700/60 space-y-3">
              <p className="text-xs font-bold text-rose-300 m-0 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Are you absolutely sure? This will permanently delete all products and invoices for this account!
              </p>

              {resetError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Enter Account Password to Confirm:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter your account password"
                    autoFocus
                    required
                    className="w-full pl-9 pr-10 py-2 bg-slate-900 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-white text-xs outline-none transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={resetting || !resetPassword}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{resetting ? 'Wiping Store Data...' : 'Yes, Wipe Everything & Start Fresh'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetPassword('');
                    setResetError('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Daily Closing WhatsApp Digest Modal */}
      {showDailyClosingModal && (
        <DailyClosingDigestModal
          settings={settings}
          user={user}
          onClose={() => setShowDailyClosingModal(false)}
        />
      )}

      {/* Customer Loyalty CRM Directory Modal */}
      {showCustomersModal && (
        <CustomersModal
          settings={settings}
          onClose={() => setShowCustomersModal(false)}
        />
      )}
    </div>
  );
}
