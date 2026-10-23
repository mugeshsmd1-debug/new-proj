import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  UserPlus,
  Star,
  Award,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Edit2,
  Check,
  Plus,
  Minus,
  Sparkles,
  RefreshCw,
  Share2
} from 'lucide-react';
import { api } from '../services/api';

export default function CustomersModal({ settings, onClose, onCustomerSelect }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Add Customer State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPoints, setNewPoints] = useState('0');
  const [creating, setCreating] = useState(false);

  // Adjust Points State
  const [adjustingCustomer, setAdjustingCustomer] = useState(null);
  const [pointsDelta, setPointsDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('Reward Bonus');
  const [savingPoints, setSavingPoints] = useState(false);

  const currency = settings?.currency_symbol || '₹';
  const shopName = settings?.shop_name || 'MS Store';

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers({ search });
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalMembers = customers.length;
    const totalPoints = customers.reduce((sum, c) => sum + (parseFloat(c.points_balance) || 0), 0);
    const totalSpent = customers.reduce((sum, c) => sum + (parseFloat(c.total_spent) || 0), 0);
    const totalVisits = customers.reduce((sum, c) => sum + (parseInt(c.visit_count) || 0), 0);
    return {
      totalMembers,
      totalPoints: totalPoints.toLocaleString(),
      totalSpent: totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      totalVisits,
    };
  }, [customers]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      alert('Please enter a phone number.');
      return;
    }

    try {
      setCreating(true);
      const created = await api.createOrUpdateCustomer({
        name: newName.trim() || 'Valued Customer',
        phone: newPhone.trim(),
        points_balance: parseFloat(newPoints) || 0,
      });

      setShowAddForm(false);
      setNewName('');
      setNewPhone('');
      setNewPoints('0');
      await fetchCustomers();

      if (onCustomerSelect) {
        onCustomerSelect(created);
        onClose();
      }
    } catch (err) {
      alert(`Failed to add customer: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleAdjustPointsSubmit = async (e) => {
    e.preventDefault();
    if (!adjustingCustomer) return;
    const delta = parseFloat(pointsDelta);
    if (isNaN(delta) || delta === 0) {
      alert('Please enter a valid points adjustment (e.g. +50 or -20).');
      return;
    }

    try {
      setSavingPoints(true);
      await api.adjustCustomerPoints(adjustingCustomer.id, {
        points_delta: delta,
        reason: adjustReason,
      });
      setAdjustingCustomer(null);
      setPointsDelta('');
      await fetchCustomers();
    } catch (err) {
      alert(`Failed to adjust points: ${err.message}`);
    } finally {
      setSavingPoints(false);
    }
  };

  const handleSendWhatsAppBalanceAlert = (cust) => {
    const cleanPhone = cust.phone.replace(/[^\d]/g, '');
    const points = cust.points_balance || 0;
    const message =
      `🌟 *Hello ${cust.name || 'Valued Customer'}!*\n\n` +
      `You currently have *${points} Loyalty Points* (worth ${currency}${points}) at *${shopName}*!\n\n` +
      `🛒 Visit us today to redeem your points and save on your shopping!\n\n` +
      `📍 *${shopName}* • Thank you for being our loyal member!`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white m-0 tracking-tight">
                  Customer Loyalty & Members CRM
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  REWARDS
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Reward repeat shoppers with points, cashbacks, and instant WhatsApp promotions
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

        {/* Stats KPI Overview */}
        <div className="p-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
            <span className="text-[11px] text-slate-400 block">Total Members</span>
            <span className="text-xl font-black text-white font-mono">{stats.totalMembers}</span>
          </div>
          <div className="p-3.5 bg-slate-800/50 border border-amber-500/30 rounded-2xl">
            <span className="text-[11px] text-amber-400 block font-semibold">Points in Circulation</span>
            <span className="text-xl font-black text-amber-300 font-mono">{stats.totalPoints} pts</span>
          </div>
          <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
            <span className="text-[11px] text-slate-400 block">Total Revenue</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{currency}{stats.totalSpent}</span>
          </div>
          <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
            <span className="text-[11px] text-slate-400 block">Store Visits</span>
            <span className="text-xl font-black text-indigo-400 font-mono">{stats.totalVisits}</span>
          </div>
        </div>

        {/* Toolbar: Search & Add Customer Button */}
        <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : 'Add New Member'}</span>
          </button>
        </div>

        {/* Collapsible Add Customer Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateCustomer}
            className="mx-6 mb-4 p-4 bg-slate-800/90 border border-amber-500/40 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end animate-fadeIn"
          >
            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                Initial Bonus Points
              </label>
              <input
                type="number"
                min="0"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save & Register'}
            </button>
          </form>
        )}

        {/* Modal Prompt to Adjust Points */}
        {adjustingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <form
              onSubmit={handleAdjustPointsSubmit}
              className="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold text-white m-0">Adjust Loyalty Points</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustingCustomer(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-300 m-0">
                  Customer: <strong className="text-white">{adjustingCustomer.name}</strong> ({adjustingCustomer.phone})
                </p>
                <p className="text-xs text-amber-400 font-mono m-0 mt-0.5">
                  Current Balance: {adjustingCustomer.points_balance} pts
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Points Adjustment (+/-)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="e.g. 50 (add) or -20 (deduct)"
                    value={pointsDelta}
                    onChange={(e) => setPointsDelta(e.target.value)}
                    required
                    autoFocus
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPointsDelta('50')}
                      className="px-2 py-1 bg-slate-800 border border-slate-700 text-[11px] text-amber-300 rounded-lg hover:bg-slate-700"
                    >
                      +50
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsDelta('100')}
                      className="px-2 py-1 bg-slate-800 border border-slate-700 text-[11px] text-amber-300 rounded-lg hover:bg-slate-700"
                    >
                      +100
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Festival Reward, Correction"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingCustomer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPoints}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition"
                >
                  {savingPoints ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Customers Table / List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading member database...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Award className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">No registered loyalty customers yet</p>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                Customers are automatically registered whenever you type their phone number at checkout.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((cust) => (
                <div
                  key={cust.id}
                  className="p-4 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  {/* Left: Customer Profile */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
                      {(cust.name || 'C')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white m-0">{cust.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                          ⭐ {cust.points_balance} PTS
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono m-0 mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{cust.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-end sm:self-auto">
                    <div className="text-right text-xs">
                      <p className="text-[11px] text-slate-400 m-0">
                        Spent: <strong className="text-white font-mono">{currency}{(parseFloat(cust.total_spent) || 0).toLocaleString()}</strong>
                      </p>
                      <p className="text-[10px] text-slate-500 m-0">
                        {cust.visit_count || 1} store {cust.visit_count === 1 ? 'visit' : 'visits'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Select for POS cart if requested */}
                      {onCustomerSelect && (
                        <button
                          type="button"
                          onClick={() => {
                            onCustomerSelect(cust);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow"
                        >
                          Select
                        </button>
                      )}

                      {/* Adjust Points Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingCustomer(cust);
                          setPointsDelta('');
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold transition"
                        title="Manually add or deduct loyalty points"
                      >
                        Adjust Pts
                      </button>

                      {/* Send WhatsApp Balance Reminder */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppBalanceAlert(cust)}
                        className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl transition"
                        title="Send WhatsApp Loyalty Points summary to customer"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
