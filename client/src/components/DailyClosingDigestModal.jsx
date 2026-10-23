import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Award,
  AlertTriangle,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

export default function DailyClosingDigestModal({ settings, user, onClose, defaultDate }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(defaultDate || todayStr);
  const [ownerPhone, setOwnerPhone] = useState(
    settings?.whatsapp_closing_phone || settings?.phone || user?.phone || ''
  );
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState(null);
  const [products, setProducts] = useState([]);
  const [copied, setCopied] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Auto closing reminder preferences
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(() => {
    try {
      return localStorage.getItem('ms_store_auto_closing_enabled') === 'true';
    } catch {
      return true;
    }
  });

  const [autoReminderTime, setAutoReminderTime] = useState(() => {
    try {
      return localStorage.getItem('ms_store_auto_closing_time') || '21:30';
    } catch {
      return '21:30';
    }
  });

  // Fetch report data for selected date
  useEffect(() => {
    let isMounted = true;
    const loadDigestData = async () => {
      try {
        setLoading(true);
        const [analytics, prods] = await Promise.all([
          api.getPnL({ mode: 'calendar', date: selectedDate }),
          api.getProducts(),
        ]);
        if (isMounted) {
          setPnlData(analytics);
          setProducts(prods || []);
        }
      } catch (err) {
        console.error('Failed to load daily closing digest:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDigestData();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const currency = settings?.currency_symbol || '₹';
  const shopName = settings?.shop_name || user?.shop_name || 'MS Store';

  // Format date nicely: "01 Oct 2026"
  const formattedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Aggregate numbers
  const digestMetrics = useMemo(() => {
    const orders = pnlData?.orders || [];
    const totalOrders = orders.length;

    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let otherTotal = 0;
    let netProfit = 0;

    for (const o of orders) {
      const amt = parseFloat(o.total_amount) || 0;
      totalRevenue += amt;
      netProfit += parseFloat(o.profit) || 0;

      const method = (o.payment_method || 'Cash').toLowerCase();
      if (method.includes('cash')) {
        cashTotal += amt;
      } else if (method.includes('upi')) {
        upiTotal += amt;
      } else if (method.includes('card')) {
        cardTotal += amt;
      } else {
        otherTotal += amt;
      }
    }

    const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    // Top Selling Item
    const topItem = pnlData?.topProfitable?.[0] || null;
    let topItemText = 'None recorded';
    if (topItem) {
      topItemText = `${topItem.product_name || 'Product'} (${topItem.units_sold || 0} pcs)`;
    }

    // Low stock items count
    const lowStockList = (products || []).filter(
      (p) => (parseFloat(p.stock_quantity) || 0) <= (parseFloat(p.low_stock_threshold) || 5)
    );
    const lowStockCount = lowStockList.length;
    const lowStockNames = lowStockList
      .slice(0, 3)
      .map((p) => p.name)
      .join(', ');

    return {
      totalOrders,
      totalRevenue: totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      cashTotal: cashTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      upiTotal: upiTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      cardTotal: cardTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      otherTotal: otherTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      hasCard: cardTotal > 0,
      hasOther: otherTotal > 0,
      netProfit: netProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      marginPct,
      topItemText,
      lowStockCount,
      lowStockNames,
    };
  }, [pnlData, products]);

  // Construct WhatsApp formatted markdown message
  const whatsappMessage = useMemo(() => {
    const paymentBreakdown = [
      `Cash: ${currency}${digestMetrics.cashTotal}`,
      `UPI: ${currency}${digestMetrics.upiTotal}`,
      digestMetrics.hasCard ? `Card: ${currency}${digestMetrics.cardTotal}` : null,
      digestMetrics.hasOther ? `Other: ${currency}${digestMetrics.otherTotal}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return (
      `📊 *${shopName} Daily Closing Report* (${formattedDate})\n\n` +
      `💰 *Total Revenue:* ${currency}${digestMetrics.totalRevenue} (${paymentBreakdown})\n` +
      `📈 *Net Profit:* ${currency}${digestMetrics.netProfit} (Margin: ${digestMetrics.marginPct}%)\n` +
      `🛒 *Total Bills:* ${digestMetrics.totalOrders} Invoices\n` +
      `🥇 *Top Item:* ${digestMetrics.topItemText}\n` +
      `⚠️ *Low Stock Alert:* ${digestMetrics.lowStockCount} items need reordering` +
      (digestMetrics.lowStockCount > 0 ? ` (${digestMetrics.lowStockNames})` : '') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *MS Store POS* • Daily Executive Summary`
    );
  }, [shopName, formattedDate, currency, digestMetrics]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      alert('Failed to copy to clipboard.');
    }
  };

  const handleSendWhatsApp = () => {
    const cleanNumber = ownerPhone.replace(/[^\d]/g, '');
    const encoded = encodeURIComponent(whatsappMessage);

    let url = `https://wa.me/${cleanNumber ? cleanNumber : ''}?text=${encoded}`;
    // If no phone is provided, opens WhatsApp share dialog directly
    if (!cleanNumber) {
      url = `https://api.whatsapp.com/send?text=${encoded}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveReminderSettings = async () => {
    try {
      setSavingSettings(true);
      localStorage.setItem('ms_store_auto_closing_enabled', String(autoReminderEnabled));
      localStorage.setItem('ms_store_auto_closing_time', autoReminderTime);
      if (ownerPhone.trim()) {
        localStorage.setItem('ms_store_whatsapp_phone', ownerPhone.trim());
      }
      alert('Automated closing digest preferences saved successfully!');
    } catch {
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white m-0 tracking-tight">
                  Daily Closing WhatsApp Summary Digest
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AUTO FORMATTED
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Executive financial & stock digest sent directly to the store owner's WhatsApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Controls: Date Picker & Owner Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Closing Report Date</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                    selectedDate === todayStr
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Today
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Owner WhatsApp Number (with country code)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 919876543210"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* WhatsApp Message Preview Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>WhatsApp Message Preview (Live Render)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition cursor-pointer font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>
            </div>

            {loading ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span>Calculating daily revenue, profits & stock counts...</span>
              </div>
            ) : (
              <div className="relative rounded-2xl bg-[#0b141a] p-4 sm:p-5 border border-emerald-900/40 shadow-inner font-sans">
                {/* Chat bubble styling mimicking WhatsApp */}
                <div className="max-w-lg bg-[#005c4b] text-[#e9edef] rounded-2xl p-4 shadow-lg space-y-2 text-xs leading-relaxed border border-emerald-700/30">
                  <div className="font-bold text-sm text-emerald-200 border-b border-emerald-600/40 pb-2">
                    📊 {shopName} Daily Closing Report ({formattedDate})
                  </div>

                  <div className="space-y-1.5 pt-1 text-[13px]">
                    <p className="m-0">
                      💰 <strong className="text-white">Total Revenue:</strong> {currency}{digestMetrics.totalRevenue}{' '}
                      <span className="text-emerald-200/90 text-xs">
                        (Cash: {currency}{digestMetrics.cashTotal} | UPI: {currency}{digestMetrics.upiTotal}
                        {digestMetrics.hasCard ? ` | Card: ${currency}${digestMetrics.cardTotal}` : ''})
                      </span>
                    </p>

                    <p className="m-0">
                      📈 <strong className="text-white">Net Profit:</strong> {currency}{digestMetrics.netProfit}{' '}
                      <span className="text-emerald-300 font-bold">(Margin: {digestMetrics.marginPct}%)</span>
                    </p>

                    <p className="m-0">
                      🛒 <strong className="text-white">Total Bills:</strong> {digestMetrics.totalOrders} Invoices
                    </p>

                    <p className="m-0">
                      🥇 <strong className="text-white">Top Item:</strong> {digestMetrics.topItemText}
                    </p>

                    <p className="m-0">
                      ⚠️ <strong className="text-white">Low Stock Alert:</strong> {digestMetrics.lowStockCount} items need reordering
                      {digestMetrics.lowStockCount > 0 && (
                        <span className="text-amber-300 text-xs block pl-5 mt-0.5">
                          ↳ {digestMetrics.lowStockNames}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="border-t border-emerald-600/40 pt-2 flex items-center justify-between text-[10px] text-emerald-300/70">
                    <span>Generated via MS Store POS</span>
                    <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Daily Automated Closing Trigger Settings */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  Automated End-of-Day WhatsApp Prompt Schedule
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReminderEnabled}
                  onChange={(e) => setAutoReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 m-0">
              When enabled, MS Store POS will automatically notify you at closing time (e.g. 9:30 PM) to dispatch this executive summary with 1 click.
            </p>

            {autoReminderEnabled && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-slate-300 font-semibold">Reminder Time:</span>
                <input
                  type="time"
                  value={autoReminderTime}
                  onChange={(e) => setAutoReminderTime(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveReminderSettings}
                  disabled={savingSettings}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition"
                >
                  Save Schedule
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Message'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send to WhatsApp Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
