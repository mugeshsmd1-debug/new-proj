import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  Clock,
  DollarSign,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Box,
  ShoppingCart
} from 'lucide-react';
import TiltCard from './TiltCard';
import ProductIcon from './ProductIcon';
import { api } from '../services/api';

export default function AiForecastView({ settings, onRestockProduct }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'LOW', 'HEALTHY', 'SLOW_MOVING'
  const [search, setSearch] = useState('');

  const currency = settings?.currency_symbol || '₹';

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getReorderForecast();
      setData(res);
    } catch (err) {
      console.error('Failed to fetch AI forecast:', err);
      setError(err.message || 'Failed to calculate AI depletion forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const items = data?.items || [];
  const summary = data?.summary || { total_products: 0, critical_count: 0, total_recommended_cost: 0 };

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    let matchFilter = true;
    if (filter === 'CRITICAL') {
      matchFilter = item.urgency === 'CRITICAL' || item.urgency === 'OUT_OF_STOCK';
    } else if (filter === 'LOW') {
      matchFilter = item.urgency === 'LOW';
    } else if (filter === 'HEALTHY') {
      matchFilter = item.urgency === 'HEALTHY';
    } else if (filter === 'SLOW_MOVING') {
      matchFilter = item.urgency === 'SLOW_MOVING';
    }

    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* AI Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Smart Stock Depletion Engine</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight m-0">
              AI Reorder & Depletion Forecasting
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl m-0">
              Analyzes historical sales velocity over the last 30 days to predict exact stock-out dates and calculates optimal restock quantities to prevent losing sales.
            </p>
          </div>

          <button
            onClick={fetchForecast}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate AI Model</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Critical Alerts */}
        <TiltCard className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-rose-400 font-semibold">Critical Stock-outs (≤ 3 Days)</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono m-0">
            {summary.critical_count}{' '}
            <span className="text-xs font-normal text-rose-400">products at risk</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 m-0">
            Will run out based on current sales speed
          </p>
        </TiltCard>

        {/* Estimated Reorder Budget Needed */}
        <TiltCard className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-indigo-400 font-semibold">Recommended Restock Budget</span>
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-400 font-mono m-0">
            {currency}{summary.total_recommended_cost.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 m-0">
            Estimated capital to maintain a 14-day stock buffer
          </p>
        </TiltCard>

        {/* Total Tracked Catalog */}
        <TiltCard className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">Analyzed Catalog</span>
            <div className="p-2 rounded-xl bg-slate-800 text-sky-400">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono m-0">
            {summary.total_products}{' '}
            <span className="text-xs font-normal text-slate-400">items</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 m-0">
            Continuously monitored by velocity tracker
          </p>
        </TiltCard>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-700/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'CRITICAL', label: `🚨 Critical / Out (${summary.critical_count})` },
            { id: 'LOW', label: '⚠️ Low (4-7 Days)' },
            { id: 'HEALTHY', label: '✅ Healthy' },
            { id: 'SLOW_MOVING', label: '💤 Slow Moving' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter forecast..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-60 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Main Table / Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold">Running predictive depletion model...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-xs">No products match this forecast filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isOutOfStock = item.urgency === 'OUT_OF_STOCK';
            const isCritical = item.urgency === 'CRITICAL';
            const isLow = item.urgency === 'LOW';

            return (
              <div
                key={item.id}
                className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  isOutOfStock || isCritical
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500 shadow-lg shadow-rose-950/20'
                    : isLow
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500'
                    : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400">
                        <ProductIcon category={item.category} className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight m-0">{item.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.sku} • {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isOutOfStock ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Out of Stock
                      </span>
                    ) : isCritical ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Critical (&le; 3d)
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Low (&le; 7d)
                      </span>
                    ) : item.urgency === 'SLOW_MOVING' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        Slow Moving
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Healthy
                      </span>
                    )}
                  </div>

                  {/* Stock & Velocity Metrics */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Current Stock</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {item.current_stock} {item.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sales Speed (30d)</span>
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        {item.daily_velocity} <span className="text-[10px] font-normal text-slate-400">/day</span>
                      </span>
                    </div>
                  </div>

                  {/* Depletion Timeline Gauge */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Est. Depletion:
                      </span>
                      <span
                        className={`font-semibold font-mono ${
                          isOutOfStock || isCritical
                            ? 'text-rose-400'
                            : isLow
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isOutOfStock
                          ? 'Empty Now'
                          : item.days_remaining >= 999
                          ? 'Stable (> 90 days)'
                          : `~${item.days_remaining} days left`}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOutOfStock || isCritical
                            ? 'bg-rose-500'
                            : isLow
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(8, (item.days_remaining / 30) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Recommendation Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">AI Recommended Reorder:</span>
                    <span className="text-xs font-black text-indigo-400 font-mono">
                      +{item.recommended_reorder_qty} {item.unit}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({currency}{item.estimated_reorder_cost.toLocaleString()})
                      </span>
                    </span>
                  </div>

                  {onRestockProduct && (
                    <button
                      onClick={() =>
                        onRestockProduct(
                          { ...item, stock_quantity: item.current_stock },
                          item.recommended_reorder_qty
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1 transition"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Restock</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
