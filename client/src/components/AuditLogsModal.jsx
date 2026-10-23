import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  Search,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  PackageCheck,
  ShoppingBag,
  Trash2,
  Download,
  Filter
} from 'lucide-react';
import { api } from '../services/api';

export default function AuditLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getAuditLogs(150);
      setLogs(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    const matchSearch =
      (l.product_name && l.product_name.toLowerCase().includes(search.toLowerCase())) ||
      (l.product_sku && l.product_sku.toLowerCase().includes(search.toLowerCase())) ||
      (l.note && l.note.toLowerCase().includes(search.toLowerCase()));

    let matchType = true;
    if (filterType !== 'ALL') {
      matchType = l.type === filterType;
    }

    return matchSearch && matchType;
  });

  const exportCsv = () => {
    if (!logs.length) return;
    const headers = ['Date', 'Time', 'Product', 'SKU', 'Action Type', 'Change', 'Stock After', 'Note'];
    const rows = logs.map((l) => {
      const d = new Date(l.created_at);
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        `"${(l.product_name || '').replace(/"/g, '""')}"`,
        l.product_sku || '',
        l.type || '',
        l.quantity_change,
        l.quantity_after,
        `"${(l.note || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ms_store_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white m-0">Staff Activity & Inventory Audit Trail</h2>
              <p className="text-xs text-slate-400 m-0">
                Complete forensic history of stock movements, manual edits, returns, and write-offs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={logs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              title="Export as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, SKU or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Type Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            {[
              { id: 'ALL', label: 'All Logs' },
              { id: 'SALE', label: 'Sales' },
              { id: 'RESTOCK', label: 'Restocks' },
              { id: 'RETURN', label: 'Returns' },
              { id: 'DAMAGED_WRITE_OFF', label: 'Damaged' },
              { id: 'ADJUSTMENT', label: 'Adjustments' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                  filterType === t.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Loading audit trail...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No activity logs matching this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3 text-center">Action</th>
                    <th className="py-3 px-3 text-right">Change</th>
                    <th className="py-3 px-3 text-right">Stock After</th>
                    <th className="py-3 px-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLogs.map((log) => {
                    const isPositive = log.quantity_change > 0;
                    const isDamaged = log.type === 'DAMAGED_WRITE_OFF';
                    const isReturn = log.type === 'RETURN';
                    const isSale = log.type === 'SALE';
                    const isRestock = log.type === 'RESTOCK';

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/50 transition">
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-white m-0 leading-tight">{log.product_name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.product_sku}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isDamaged ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Write-Off
                            </span>
                          ) : isReturn ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Return
                            </span>
                          ) : isSale ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              Sale
                            </span>
                          ) : isRestock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Restock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                              Adjust
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {isPositive ? `+${log.quantity_change}` : log.quantity_change}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-white font-semibold">
                          {log.quantity_after}
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate text-[11px]">
                          {log.note || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
