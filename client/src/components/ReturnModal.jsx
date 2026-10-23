import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  Printer,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Banknote,
  Tag
} from 'lucide-react';
import { api } from '../services/api';

export default function ReturnModal({ order, settings, isOpen, onClose, onReturnCompleted }) {
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Selected return items: { [productId]: { quantity, restock: true, reason } }
  const [returnItems, setReturnItems] = useState({});
  const [refundType, setRefundType] = useState('Cash'); // 'Cash' or 'Store Credit'
  const [defaultReason, setDefaultReason] = useState('Customer Changed Mind');
  const [notes, setNotes] = useState('');

  // Completed credit note voucher state
  const [creditNote, setCreditNote] = useState(null);

  const currency = settings?.currency_symbol || '₹';

  useEffect(() => {
    if (!isOpen || !order) return;
    setCreditNote(null);
    setError('');

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await api.getOrderById(order.id);
        setOrderDetails(data);

        // Initialize return quantities to 0
        const initial = {};
        (data?.items || []).forEach((item) => {
          initial[item.product_id || item.id] = {
            order_item_id: item.id,
            product_id: item.product_id,
            name: item.name || item.product_name,
            unitSelling: parseFloat(item.selling_price) || 0,
            gstPct: parseFloat(item.gst_percentage) || 0,
            maxQty: parseFloat(item.quantity) || 1,
            returnQty: 0,
            restock: true,
          };
        });
        setReturnItems(initial);
      } catch (err) {
        setError(err.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleQtyChange = (pId, newQty) => {
    setReturnItems((prev) => {
      const item = prev[pId];
      if (!item) return prev;
      const validQty = Math.max(0, Math.min(item.maxQty, parseFloat(newQty) || 0));
      return {
        ...prev,
        [pId]: { ...item, returnQty: validQty },
      };
    });
  };

  const handleRestockToggle = (pId) => {
    setReturnItems((prev) => {
      const item = prev[pId];
      if (!item) return prev;
      return {
        ...prev,
        [pId]: { ...item, restock: !item.restock },
      };
    });
  };

  // Calculate total refund
  const totalRefund = Object.values(returnItems).reduce((sum, item) => {
    const itemSub = item.unitSelling * item.returnQty;
    const itemTax = itemSub * (item.gstPct / 100);
    return sum + itemSub + itemTax;
  }, 0);

  const totalReturnUnits = Object.values(returnItems).reduce((sum, item) => sum + item.returnQty, 0);

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (totalReturnUnits <= 0) {
      setError('Please select at least 1 item quantity to return.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const itemsPayload = Object.values(returnItems)
        .filter((i) => i.returnQty > 0)
        .map((i) => ({
          order_item_id: i.order_item_id,
          product_id: i.product_id,
          quantity: i.returnQty,
          restock: i.restock,
          reason: defaultReason,
        }));

      const res = await api.processReturn(order.id, {
        items: itemsPayload,
        refund_type: refundType,
        reason: defaultReason,
        note: notes,
      });

      setCreditNote(res);
      if (onReturnCompleted) onReturnCompleted();
    } catch (err) {
      setError(err.message || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white m-0">Sales Return & Exchange</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {order.invoice_no}
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0">
                Customer: <strong className="text-slate-200">{order.customer_name || 'Walk-in'}</strong> • Issued: {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {creditNote ? (
          /* Credit Note Generated Screen */
          <div className="p-6 sm:p-8 space-y-5 overflow-y-auto text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white m-0">Return Processed Successfully!</h3>
              <p className="text-xs text-slate-400 mt-1 m-0">
                Inventory has been reversed and restocked automatically.
              </p>
            </div>

            {/* Credit Note Receipt Card */}
            <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Credit Note Ref:</span>
                <span className="text-emerald-400 font-bold">{creditNote.credit_note_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Original Invoice:</span>
                <span className="text-white">{creditNote.original_invoice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-white">{creditNote.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Refund Settlement:</span>
                <span className="text-amber-400 font-semibold">{creditNote.refund_type}</span>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-400 mb-1">Returned Items:</p>
                {(creditNote.returned_items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-300">
                    <span>{it.product_name} x {it.quantity}</span>
                    <span className="text-white font-bold">{currency}{it.refund.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
                <span className="text-white">Total Refund Issued:</span>
                <span className="text-emerald-400 text-base">{currency}{creditNote.refund_amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Credit Note</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Done
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Loading items from invoice...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Select Return Items */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Select Items to Return
              </span>

              <div className="space-y-2">
                {Object.values(returnItems).map((item) => (
                  <div
                    key={item.product_id}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      item.returnQty > 0
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate m-0">{item.name}</p>
                      <span className="text-xs text-slate-400 font-mono">
                        Sold Price: {currency}{item.unitSelling.toFixed(2)} • GST: {item.gstPct}% • Max Returnable: {item.maxQty}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Quantity input */}
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 py-1 rounded-xl">
                        <span className="text-xs text-slate-400">Return:</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={item.maxQty}
                          value={item.returnQty}
                          onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                          className="w-14 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Restock toggle */}
                      {item.returnQty > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRestockToggle(item.product_id)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                            item.restock
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                          }`}
                          title={item.restock ? 'Item will be restocked in inventory' : 'Item marked damaged (will not restock)'}
                        >
                          {item.restock ? '✓ Restock' : '✕ Scrap'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Return
                </label>
                <select
                  value={defaultReason}
                  onChange={(e) => setDefaultReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Defective / Damaged Item">Defective / Damaged Item</option>
                  <option value="Wrong Item Purchased">Wrong Item Purchased</option>
                  <option value="Expired Product">Expired Product</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              {/* Refund Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Refund Settlement Mode
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'Cash', label: 'Cash Refund', icon: Banknote },
                    { id: 'Store Credit', label: 'Credit Note', icon: Tag },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setRefundType(m.id)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                          refundType === m.id
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Summary & Confirm Button */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block">Total Refund Payable:</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {currency}{totalRefund.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || totalReturnUnits <= 0}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{submitting ? 'Processing Return...' : 'Confirm Return & Refund'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
