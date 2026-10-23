import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ShoppingCart,
  Award,
  Receipt,
  ArrowUpRight,
  BarChart3,
  PieChart,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Layers,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  X,
  Lock,
  Eye,
  EyeOff,
  Key,
  RotateCcw,
  MessageSquare,
  Share2
} from 'lucide-react';
import TiltCard from '../components/TiltCard';
import ReceiptModal from '../components/ReceiptModal';
import ReturnModal from '../components/ReturnModal';
import DailyClosingDigestModal from '../components/DailyClosingDigestModal';
import { api } from '../services/api';

export default function ProfitLossView({ settings }) {
  // Report Modes: 'calendar' (Daily), 'month' (Monthly), 'year' (1-Year Annual), 'all' (All-Time)
  const [reportMode, setReportMode] = useState('calendar');

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentYearNum = new Date().getFullYear();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearNum);

  const [pnlData, setPnlData] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [returnOrder, setReturnOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDigestModal, setShowDigestModal] = useState(false);

  // Single invoice delete with password state
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  // Bulk bill deletion with password state
  const [showClearBillsConfirm, setShowClearBillsConfirm] = useState(false);
  const [clearBillsPassword, setClearBillsPassword] = useState('');
  const [showClearBillsPassword, setShowClearBillsPassword] = useState(false);
  const [clearBillsError, setClearBillsError] = useState('');
  const [deletingBills, setDeletingBills] = useState(false);

  const currency = settings?.currency_symbol || '₹';

  const openDeleteInvoiceModal = (order) => {
    setInvoiceToDelete(order);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const closeDeleteInvoiceModal = () => {
    setInvoiceToDelete(null);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  const handleConfirmDeleteInvoice = async (e) => {
    if (e) e.preventDefault();
    if (!invoiceToDelete) return;

    if (!deletePassword.trim()) {
      setDeleteError('Please enter your account password to verify deletion.');
      return;
    }

    try {
      setIsDeletingInvoice(true);
      setDeleteError('');
      await api.deleteOrder(invoiceToDelete.id, deletePassword.trim());
      closeDeleteInvoiceModal();
      await fetchData();
      alert(`Invoice ${invoiceToDelete.invoice_no} has been deleted and stock was returned.`);
    } catch (err) {
      console.error('Delete invoice error:', err);
      setDeleteError(err.message || 'Incorrect password or failed to delete invoice.');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const openClearBillsModal = () => {
    setShowClearBillsConfirm(true);
    setClearBillsPassword('');
    setShowClearBillsPassword(false);
    setClearBillsError('');
  };

  const closeClearBillsModal = () => {
    setShowClearBillsConfirm(false);
    setClearBillsPassword('');
    setShowClearBillsPassword(false);
    setClearBillsError('');
  };

  const handleConfirmClearAllBills = async (e) => {
    if (e) e.preventDefault();
    if (!clearBillsPassword.trim()) {
      setClearBillsError('Please enter your account password to verify deletion.');
      return;
    }

    try {
      setDeletingBills(true);
      setClearBillsError('');
      await api.clearBillHistory(clearBillsPassword.trim());
      closeClearBillsModal();
      await fetchData();
      alert('All bill history has been deleted. Product inventory remains safe.');
    } catch (err) {
      console.error('Clear bills error:', err);
      setClearBillsError(err.message || 'Incorrect password or failed to delete bill history.');
    } finally {
      setDeletingBills(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let params = { mode: reportMode };

      if (reportMode === 'calendar') {
        params.date = selectedDate;
      } else if (reportMode === 'month') {
        params.month = selectedMonth;
      } else if (reportMode === 'year') {
        params.year = selectedYear;
      } else if (reportMode === 'all') {
        params.range = 'all';
      }

      const analytics = await api.getPnL(params);
      setPnlData(analytics);
    } catch (err) {
      console.error('Failed to load report analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportMode, selectedDate, selectedMonth, selectedYear]);

  const handleViewReceipt = async (orderId) => {
    try {
      const detailedOrder = await api.getOrderById(orderId);
      setSelectedReceipt({
        ...detailedOrder,
        invoiceNo: detailedOrder.invoice_no,
      });
    } catch (err) {
      alert('Failed to load invoice receipt.');
    }
  };

  const summary = pnlData?.summary || {};
  const isNetProfit = (summary.net_profit || 0) >= 0;
  const dailyTrend = pnlData?.dailyTrend || [];
  const topProfitable = pnlData?.topProfitable || [];
  const reportOrders = pnlData?.orders || [];
  const annualMonthlyBreakdown = pnlData?.annualMonthlyBreakdown || [];
  const inventoryStats = pnlData?.inventoryStats || {};

  // Scaling factor for daily bar chart
  const maxDayRevenue = Math.max(...dailyTrend.map((d) => d.daily_revenue || 0), 100);

  // Quick jump helper for calendar date
  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Reporting Mode Navigation Tabs */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight m-0">
                Financial Reports & Profit / Loss
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                  isNetProfit
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isNetProfit ? 'PROFITABLE' : 'NET LOSS'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 m-0">
              Interactive multi-horizon reports: Calendar-wise Daily, Monthly, and 1-Year Annual statements
            </p>
          </div>

          {/* Sub-tab Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 text-xs font-semibold">
            {[
              { id: 'calendar', label: '📅 Daily / Calendar', desc: 'Calendar-wise' },
              { id: 'month', label: '📆 Monthly Report', desc: 'Month by Month' },
              { id: 'year', label: '🏛️ 1-Year Report', desc: 'Annual (12 Mo)' },
              { id: 'all', label: '📈 All-Time Overview', desc: 'Overall' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportMode(tab.id)}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  reportMode === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Selector Bar based on active reporting mode */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode 1: Calendar Date Selector */}
          {reportMode === 'calendar' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Select Date:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-indigo-500/50 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-400 shadow-sm"
              />
              <button
                onClick={() => setQuickDate(0)}
                className={`px-2.5 py-1.5 rounded-xl border transition ${
                  selectedDate === todayStr
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setQuickDate(-1)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                Yesterday
              </button>
              <span className="text-slate-500 font-mono pl-2">
                Viewing: {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}

          {/* Mode 2: Month Selector */}
          {reportMode === 'month' && (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Select Month:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-indigo-500/50 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-400 shadow-sm"
              />
              <button
                onClick={() => setSelectedMonth(currentMonthStr)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                Current Month
              </button>
            </div>
          )}

          {/* Mode 3: Year Selector */}
          {reportMode === 'year' && (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Select Fiscal / Calendar Year:
              </span>
              <div className="flex items-center gap-1">
                {[currentYearNum - 2, currentYearNum - 1, currentYearNum, currentYearNum + 1].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-xl font-mono font-bold transition ${
                      selectedYear === yr
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
              <span className="text-slate-500 text-xs hidden sm:inline">
                Full 12-Month Jan to Dec Annual Audit
              </span>
            </div>
          )}

          {/* Mode 4: All-Time Summary */}
          {reportMode === 'all' && (
            <div className="text-slate-400">
              Aggregated historical ledger of all invoices and inventory valuation
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDigestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30 cursor-pointer"
              title="Generate and send daily closing executive digest to WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Daily Close</span>
            </button>

            {/* Live indicator */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{pnlData?.title || 'Report Loaded'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Metric Cards with 3D Tilt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <TiltCard className="p-5 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {reportMode === 'calendar' ? 'Day Revenue' : reportMode === 'month' ? 'Monthly Revenue' : reportMode === 'year' ? 'Annual Revenue' : 'Total Revenue'}
            </span>
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono m-0">
            {currency}{(summary.total_revenue || 0).toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Gross Sales: {currency}{(summary.gross_sales || 0).toFixed(2)}</span>
            <span>Tax: {currency}{(summary.total_tax || 0).toFixed(2)}</span>
          </div>
        </TiltCard>

        {/* Cost of Goods Sold (COGS) */}
        <TiltCard className="p-5 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Cost of Goods (COGS)
            </span>
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-400 font-mono m-0">
            {currency}{(summary.total_cost || 0).toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Discounts: {currency}{(summary.total_discounts || 0).toFixed(2)}</span>
            <span className="text-rose-400/80">Acquisition cost</span>
          </div>
        </TiltCard>

        {/* Net Profit / Loss */}
        <TiltCard
          className={`p-5 rounded-3xl border shadow-xl ${
            isNetProfit
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/50'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Net {isNetProfit ? 'Profit' : 'Loss'}
            </span>
            <div
              className={`p-2.5 rounded-2xl ${
                isNetProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isNetProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>
          <p
            className={`text-3xl font-black font-mono m-0 ${
              isNetProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isNetProfit ? '+' : ''}
            {currency}{(summary.net_profit || 0).toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] flex items-center justify-between border-t border-slate-800 pt-2">
            <span className={isNetProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              Margin: {summary.profit_margin || 0}%
            </span>
            <span className="text-slate-400">{summary.total_orders || 0} Invoices</span>
          </div>
        </TiltCard>

        {/* Orders & Avg Order Value */}
        <TiltCard className="p-5 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Order Volume & AOV
            </span>
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-400 font-mono m-0">
            {summary.total_orders || 0}
            <span className="text-sm font-normal text-slate-400 ml-1.5">orders</span>
          </p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Avg Order Value:</span>
            <span className="font-mono text-white font-bold">
              {currency}
              {summary.total_orders > 0
                ? ((summary.total_revenue || 0) / summary.total_orders).toFixed(2)
                : '0.00'}
            </span>
          </div>
        </TiltCard>
      </div>

      {/* 1-YEAR (ANNUAL) 12-MONTH TABLE - Displayed when 'year' mode is active */}
      {reportMode === 'year' && (
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white m-0">
                  {selectedYear} Annual Performance Breakdown (12 Months Jan - Dec)
                </h3>
                <p className="text-xs text-slate-400 m-0">
                  Month-by-month financial statement of revenue, cost, net gain, and margins
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs">
              Year {selectedYear}
            </span>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">Cost (COGS)</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {annualMonthlyBreakdown.map((m) => {
                  const hasSales = m.orders_count > 0;
                  const isMonthProfitable = m.profit >= 0;
                  return (
                    <tr key={m.month} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-sans font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>{m.month} ({m.monthKey})</span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300">
                        {m.orders_count}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {currency}{m.revenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400">
                        {currency}{m.cost.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          !hasSales
                            ? 'text-slate-500'
                            : isMonthProfitable
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {hasSales ? (isMonthProfitable ? '+' : '') : ''}
                        {currency}{m.profit.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasSales ? `${m.margin}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {!hasSales ? (
                          <span className="text-[10px] text-slate-500">No Sales</span>
                        ) : isMonthProfitable ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Profit
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Loss
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visual Analytics Grid: Daily Sales & Profit Trend + Top Profit Contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Bar Chart (7 or 8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white m-0">
                {reportMode === 'calendar' ? 'Hourly / Daily Sales Distribution' : 'Daily Sales & Profit Trend'}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Profit
              </span>
            </div>
          </div>

          {dailyTrend.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No sales transactions recorded for this selection. Make a sale in POS Billing to see real-time charts!
            </div>
          ) : (
            <div className="pt-6">
              <div className="flex items-end justify-between gap-2 h-44 border-b border-slate-800 pb-2">
                {dailyTrend.map((day, idx) => {
                  const revHeight = Math.max(10, Math.min(100, (day.daily_revenue / maxDayRevenue) * 100));
                  const profitHeight = Math.max(
                    5,
                    Math.min(100, (Math.max(0, day.daily_profit) / maxDayRevenue) * 100)
                  );

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                    >
                      {/* Floating Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-14 bg-slate-800 border border-slate-600 px-2.5 py-1.5 rounded-xl shadow-xl text-[10px] text-white z-30 whitespace-nowrap transition">
                        <p className="font-bold text-indigo-300">{day.date}</p>
                        <p>
                          Rev: {currency}{day.daily_revenue} | Profit: +{currency}{day.daily_profit}
                        </p>
                      </div>

                      {/* Dual Bar pair */}
                      <div className="w-full flex items-end justify-center gap-1 h-full">
                        <div
                          style={{ height: `${revHeight}%` }}
                          className="w-1/2 max-w-[16px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                        />
                        <div
                          style={{ height: `${profitHeight}%` }}
                          className="w-1/2 max-w-[16px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                        />
                      </div>

                      <span className="text-[9px] text-slate-500 font-mono truncate max-w-full">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top Profitable Items (5 or 4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white m-0">Top Profit Products</h3>
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">By Net Gain</span>
          </div>

          <div className="space-y-3">
            {topProfitable.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-bold text-slate-200 truncate m-0">{item.product_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono m-0">
                      {item.units_sold} sold • Sales: {currency}{item.total_sales}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-black text-emerald-400 text-sm m-0">
                    +{currency}{item.total_profit}
                  </p>
                  <p className="text-[10px] text-emerald-500/80 m-0">Net Gain</p>
                </div>
              </div>
            ))}

            {topProfitable.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs">
                No product profit data recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoices & Orders for this Report Selection */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white m-0">
              {reportMode === 'calendar'
                ? `Invoices & Sales for ${selectedDate}`
                : reportMode === 'month'
                ? `Invoices for Month ${selectedMonth}`
                : 'Invoices & Order Transactions'}
            </h3>
            <p className="text-xs text-slate-400 m-0">
              Individual bill records with itemized revenues, cost, and net profit
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              {reportOrders.length} {reportOrders.length === 1 ? 'order' : 'orders'} found
            </span>
            {reportOrders.length > 0 && (
              <button
                type="button"
                onClick={openClearBillsModal}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Delete all past bill history while preserving product inventory"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Bill History</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Cost (COGS)</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reportOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                    {o.invoice_no}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    {o.customer_name || 'Walk-in'}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {new Date(o.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300">
                      {o.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">
                    {currency}{(o.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-400">
                    {currency}{(o.total_cost || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                    +{currency}{(o.profit || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleViewReceipt(o.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-semibold transition"
                        title="View printed bill receipt"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => setReturnOrder(o)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-600 text-amber-300 hover:text-white text-[11px] font-semibold transition active:scale-95"
                        title={`Process return / refund for ${o.invoice_no}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Return</span>
                      </button>
                      <button
                        onClick={() => openDeleteInvoiceModal(o)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 text-rose-300 hover:text-white text-[11px] font-semibold transition active:scale-95"
                        title={`Delete invoice ${o.invoice_no}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {reportOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No orders recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Health & Valuation Snapshot */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white m-0">Inventory Valuation & Potential Gain</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Total Items in Stock</span>
            <span className="text-lg font-black text-white font-mono">
              {inventoryStats.total_items_in_stock || 0}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Stock Cost Value</span>
            <span className="text-lg font-black text-rose-400 font-mono">
              {currency}{(inventoryStats.inventory_cost_value || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Stock Retail Value</span>
            <span className="text-lg font-black text-indigo-400 font-mono">
              {currency}{(inventoryStats.inventory_retail_value || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Potential Net Gain</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              +{currency}{(inventoryStats.potential_profit || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          settings={settings}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Return & Credit Note Modal */}
      {returnOrder && (
        <ReturnModal
          order={returnOrder}
          settings={settings}
          isOpen={!!returnOrder}
          onClose={() => setReturnOrder(null)}
          onReturnCompleted={() => fetchPnLData(reportMode)}
        />
      )}

      {/* Individual Invoice Delete Password Verification Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white m-0">Delete Invoice</h3>
                  <p className="text-[11px] text-slate-400 m-0">Account password required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteInvoiceModal}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Invoice details summary */}
            <div className="p-3.5 bg-slate-800/70 border border-slate-700/70 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Invoice Number:</span>
                <span className="font-mono font-bold text-indigo-400">{invoiceToDelete.invoice_no}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Customer:</span>
                <span className="font-medium text-white">{invoiceToDelete.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Amount:</span>
                <span className="font-mono font-bold text-emerald-400">{currency}{(invoiceToDelete.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              <p className="m-0 leading-relaxed text-slate-300">
                Sold items in this invoice will be automatically returned to your product inventory stock count.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeleteInvoice} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter Account Password to Confirm:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your account password"
                    autoFocus
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-white text-xs outline-none transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 m-0">
                  Enter the password set during account creation to authorize deletion.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeDeleteInvoiceModal}
                  disabled={isDeletingInvoice}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingInvoice || !deletePassword}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingInvoice ? 'Verifying & Deleting...' : 'Delete Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bill History Alone Confirmation Modal */}
      {showClearBillsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white m-0">Delete Bill History Alone</h3>
                  <p className="text-[11px] text-slate-400 m-0">Safe for your product inventory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeClearBillsModal}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="m-0">
                Are you sure you want to delete <strong className="text-white">all billing and invoice history</strong>?
              </p>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] space-y-1">
                <p className="font-bold m-0 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> What will NOT be deleted:
                </p>
                <p className="m-0 text-slate-300">
                  Your products catalog, stock counts, categories, and store settings remain 100% untouched and safe.
                </p>
              </div>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px]">
                <p className="m-0">
                  Past bills, invoices, receipts, and revenue/profit sales totals will be cleared to zero.
                </p>
              </div>
            </div>

            {clearBillsError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{clearBillsError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmClearAllBills} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter Account Password to Confirm:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showClearBillsPassword ? 'text' : 'password'}
                    value={clearBillsPassword}
                    onChange={(e) => setClearBillsPassword(e.target.value)}
                    placeholder="Enter your account password"
                    autoFocus
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-white text-xs outline-none transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClearBillsPassword(!showClearBillsPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  >
                    {showClearBillsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeClearBillsModal}
                  disabled={deletingBills}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingBills || !clearBillsPassword}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingBills ? 'Deleting Bills...' : 'Yes, Delete Bill History'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automated Daily Closing WhatsApp Summary Modal */}
      {showDigestModal && (
        <DailyClosingDigestModal
          settings={settings}
          defaultDate={selectedDate}
          onClose={() => setShowDigestModal(false)}
        />
      )}
    </div>
  );
}
