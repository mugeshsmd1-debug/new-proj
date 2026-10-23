import React, { useState, useEffect } from 'react';
import { X, Plus, PackageCheck, AlertCircle, ArrowRight, AlertTriangle, Trash2 } from 'lucide-react';
import ProductIcon from './ProductIcon';

export default function RestockModal({ product, isOpen, onClose, onRestock }) {
  const [mode, setMode] = useState('add'); // 'add', 'set', or 'damage'
  const [amount, setAmount] = useState('10');
  const [note, setNote] = useState('Stock shipment replenishment');
  const [damageReason, setDamageReason] = useState('Expired / Past Best Before');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product?.suggestedQty) {
      setAmount(String(product.suggestedQty));
      setNote('AI Predictive Restock replenishment');
      setMode('add');
    } else {
      setAmount('10');
      setNote('Stock shipment replenishment');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentStock = parseFloat(product.stock_quantity) || 0;
  const parsedAmount = parseFloat(String(amount).trim()) || 0;

  let newStock = currentStock;
  if (mode === 'add') {
    newStock = currentStock + parsedAmount;
  } else if (mode === 'set') {
    newStock = parsedAmount;
  } else if (mode === 'damage') {
    newStock = Math.max(0, currentStock - parsedAmount);
  }
  newStock = parseFloat(newStock.toFixed(3));

  const financialLoss = mode === 'damage' ? parsedAmount * (parseFloat(product.cost_price) || 0) : 0;
  const quickAmounts = [5, 10, 20, 50, 100];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Please enter a valid positive number for quantity.');
      return;
    }

    if (mode === 'damage' && parsedAmount > currentStock) {
      setError(`Cannot write off more than available stock (${currentStock} ${product.unit}).`);
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (mode === 'add') {
        await onRestock(product.id, { delta: parsedAmount, note, type: 'RESTOCK' });
      } else if (mode === 'set') {
        await onRestock(product.id, { newStock: parsedAmount, note, type: 'ADJUSTMENT' });
      } else if (mode === 'damage') {
        await onRestock(product.id, {
          delta: -parsedAmount,
          note: `Damaged/Expired Write-off (${damageReason})${note ? ' - ' + note : ''}`,
          type: 'DAMAGED_WRITE_OFF',
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center p-0.5 bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden">
              <ProductIcon icon={product.image_emoji} className="w-8 h-8 object-cover" textClassName="text-2xl" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Update Stock & Shrinkage</h2>
              <p className="text-xs text-slate-400 font-mono">{product.name} ({product.sku})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Projected Stock Banner */}
          <div className={`p-4 rounded-2xl flex items-center justify-around border transition ${
            mode === 'damage'
              ? 'bg-rose-950/20 border-rose-500/40'
              : 'bg-slate-800/60 border-slate-700/80'
          }`}>
            <div className="text-center">
              <p className="text-[11px] text-slate-400">Current Stock</p>
              <p className="text-xl font-extrabold text-slate-200 m-0">
                {currentStock} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
              </p>
            </div>
            <ArrowRight className={`w-5 h-5 ${mode === 'damage' ? 'text-rose-400' : 'text-indigo-400'}`} />
            <div className="text-center">
              <p className="text-[11px] text-slate-400">Projected Stock</p>
              <p className={`text-2xl font-black m-0 ${mode === 'damage' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {newStock} <span className="text-xs font-normal">{product.unit}</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-800 rounded-xl border border-slate-700 text-xs font-medium gap-1">
            <button
              type="button"
              onClick={() => { setMode('add'); setAmount('10'); setNote('Stock shipment replenishment'); }}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'add' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              + Restock
            </button>
            <button
              type="button"
              onClick={() => { setMode('set'); setAmount(String(currentStock)); setNote('Physical inventory count adjustment'); }}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'set' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Set Count
            </button>
            <button
              type="button"
              onClick={() => { setMode('damage'); setAmount('1'); setNote(''); }}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'damage' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              ⚠️ Damaged / Expired
            </button>
          </div>

          {/* Damaged Goods Special Fields */}
          {mode === 'damage' ? (
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-rose-300 mb-1">
                  Reason for Write-off / Loss
                </label>
                <select
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                >
                  <option value="Expired / Past Best Before">Expired / Past Best Before</option>
                  <option value="Damaged in Handling">Damaged in Handling</option>
                  <option value="Broken Packaging / Spoilage">Broken Packaging / Spoilage</option>
                  <option value="Internal Shrinkage / Theft">Internal Shrinkage / Theft</option>
                  <option value="Defective from Supplier">Defective from Supplier</option>
                </select>
              </div>

              <div className="flex justify-between items-center text-xs text-rose-300 pt-1">
                <span>Cost Loss to Store:</span>
                <span className="font-mono font-bold text-sm text-white">
                  ₹{financialLoss.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            /* Quick Amount Chips for Restock */
            mode === 'add' && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5 font-medium">Quick Quantity Add:</p>
                <div className="flex gap-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        parseInt(amount, 10) === q
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      +{q}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Custom Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {mode === 'add'
                ? 'Quantity to Add'
                : mode === 'damage'
                ? 'Quantity to Write-Off (Deduct)'
                : 'New Exact Stock Total'}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-slate-800 border rounded-xl text-base font-bold text-white focus:outline-none ${
                mode === 'damage'
                  ? 'border-rose-500/50 focus:border-rose-400'
                  : 'border-slate-700 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optional Note / Tracking Ref
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Batch #402, Discarded by supervisor"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50 ${
                mode === 'damage'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {mode === 'damage' ? <Trash2 className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
              <span>{loading ? 'Processing...' : mode === 'damage' ? 'Write-Off Damaged Stock' : 'Confirm Stock Update'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
