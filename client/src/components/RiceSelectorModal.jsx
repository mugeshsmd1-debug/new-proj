import React, { useState, useMemo, useEffect } from 'react';
import { X, ShoppingBag, Plus, Minus, Check, Scale, Package, Sparkles, AlertCircle, ArrowRight, Layers } from 'lucide-react';
import ProductIcon from './ProductIcon';

export default function RiceSelectorModal({
  isOpen,
  product,
  currencySymbol = '₹',
  cartItems = [],
  onClose,
  onAddToCart,
}) {
  const p = product || {};
  const currency = currencySymbol;
  const bagWeight = parseFloat(p.bag_weight_kg) || 50;

  // Active Tab: 'bag' (Whole Sealed Bag) or 'loose' (Sell by KG)
  const allowLoose = p.allow_loose !== false;
  const [activeTab, setActiveTab] = useState('bag');

  // Available Sealed Bags & Loose Stock in container
  const sealedBagsInStock = parseFloat(p.stock_quantity) || 0;
  const openBagLooseInStock = parseFloat(p.open_bag_loose_kg) || 0;

  // Compute bags & loose kg already placed in current cart
  const cartBagsUsed = useMemo(() => {
    return (cartItems || [])
      .filter((i) => i.id === p.id && !i.is_loose)
      .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  }, [cartItems, p.id]);

  const cartLooseKgUsed = useMemo(() => {
    return (cartItems || [])
      .filter((i) => i.id === p.id && i.is_loose)
      .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  }, [cartItems, p.id]);

  const availableSealedBags = Math.max(0, sealedBagsInStock - cartBagsUsed);
  const totalAvailableKg = (sealedBagsInStock * bagWeight) + openBagLooseInStock - (cartBagsUsed * bagWeight) - cartLooseKgUsed;

  // Whole Bag State
  const wholeBagSellingPrice = parseFloat(p.selling_price) || 1450;
  const wholeBagCostPrice = parseFloat(p.cost_price) || 1400;
  const [bagQty, setBagQty] = useState(1);

  // Loose Selling State
  const looseRate = parseFloat(p.loose_selling_price) || parseFloat((wholeBagSellingPrice / bagWeight).toFixed(2)) || 30;
  const looseCostRate = parseFloat(p.loose_cost_price) || parseFloat((wholeBagCostPrice / bagWeight).toFixed(2)) || 28;

  const [looseWeight, setLooseWeight] = useState('1');
  const [looseAmount, setLooseAmount] = useState(String(looseRate));
  const [looseInputMode, setLooseInputMode] = useState('weight'); // 'weight' | 'amount'
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !product) return null;

  // Sync weight & amount inputs for loose selling
  const handleWeightChange = (val) => {
    setLooseWeight(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setLooseAmount((parsed * looseRate).toFixed(2));
    } else {
      setLooseAmount('');
    }
    setErrorMsg('');
  };

  const handleAmountChange = (val) => {
    setLooseAmount(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && looseRate > 0) {
      setLooseWeight((parsed / looseRate).toFixed(3));
    } else {
      setLooseWeight('');
    }
    setErrorMsg('');
  };

  // Add Whole Sealed Bag to Cart
  const handleAddBag = () => {
    const qty = parseInt(bagQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Please enter a valid bag quantity.');
      return;
    }

    if (qty > availableSealedBags) {
      setErrorMsg(`Insufficient sealed bags in stock! Available: ${availableSealedBags} bags, Requested: ${qty} bags.`);
      return;
    }

    const displayName = `${product.name} (${bagWeight} kg Sealed Bag)`;
    const cartKey = `${product.id}-bag`;

    onAddToCart({
      id: product.id,
      cartKey,
      name: displayName,
      original_name: product.name,
      is_grain_rice: true,
      bag_weight: bagWeight,
      is_loose: false,
      stock_deduct_per_unit: 1, // deducts 1 sealed bag
      unit: 'Bag',
      selling_price: wholeBagSellingPrice,
      cost_price: wholeBagCostPrice,
      quantity: qty,
      gst_percentage: product.gst_percentage !== undefined ? parseFloat(product.gst_percentage) : 5.0,
      image_emoji: product.image_emoji || '🍚',
    });

    onClose();
  };

  // Add Loose Rice (by KG) to Cart
  const handleAddLoose = () => {
    const weight = parseFloat(looseWeight);
    if (isNaN(weight) || weight <= 0) {
      setErrorMsg('Please enter a valid weight in kg (e.g. 1.5 kg).');
      return;
    }

    if (weight > totalAvailableKg) {
      setErrorMsg(`Insufficient stock pool! Needed: ${weight} kg, Total Store Capacity: ${totalAvailableKg.toFixed(1)} kg.`);
      return;
    }

    const displayName = `${product.name} (Loose)`;
    const cartKey = `${product.id}-loose`;

    onAddToCart({
      id: product.id,
      cartKey,
      name: displayName,
      original_name: product.name,
      is_grain_rice: true,
      bag_weight: bagWeight,
      is_loose: true,
      stock_deduct_per_unit: 1, // in kg
      unit: 'kg',
      selling_price: looseRate,
      cost_price: looseCostRate,
      quantity: weight,
      gst_percentage: product.gst_percentage !== undefined ? parseFloat(product.gst_percentage) : 5.0,
      image_emoji: product.image_emoji || '🍚',
    });

    onClose();
  };

  const totalBagPrice = bagQty * wholeBagSellingPrice;
  const totalLoosePrice = (parseFloat(looseWeight) || 0) * looseRate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
              <ProductIcon icon={product.image_emoji || '🍚'} className="w-10 h-10 object-cover" textClassName="text-3xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  🌾 {bagWeight} kg Sealed Bag Product
                </span>
                <span className="text-xs font-mono text-slate-400">{product.sku}</span>
              </div>
              <h3 className="text-lg font-bold text-white m-0 line-clamp-1">{product.name}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Shop Stock Banner (Sealed Bags + Open Bag Loose) */}
        <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">📦 Sealed Bags:</span>
            <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
              {availableSealedBags} Bags ({bagWeight} kg each)
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-400">⚖️ Loose in Drum:</span>
            <span className="px-2 py-0.5 rounded font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30">
              {openBagLooseInStock} kg
            </span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('bag'); setErrorMsg(''); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                activeTab === 'bag'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>🎒 Sell Whole Bag ({currency}{wholeBagSellingPrice})</span>
            </button>

            <button
              type="button"
              disabled={!allowLoose}
              onClick={() => { setActiveTab('loose'); setErrorMsg(''); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                !allowLoose
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : activeTab === 'loose'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>⚖️ Sell Loose ({currency}{looseRate}/kg)</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: WHOLE SEALED BAG SELLING */}
          {activeTab === 'bag' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-800/80 to-slate-900 border border-indigo-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-base">{bagWeight} kg Sealed Bag</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded">
                      Full Pack
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 m-0">
                    Cost: {currency}{wholeBagCostPrice} • Profit: <strong className="text-emerald-400">+{currency}{(wholeBagSellingPrice - wholeBagCostPrice).toFixed(2)} / bag</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white font-mono block">
                    {currency}{wholeBagSellingPrice}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({currency}{(wholeBagSellingPrice / bagWeight).toFixed(2)}/kg)
                  </span>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">Number of Bags to Sell:</span>
                    <p className="text-[11px] text-slate-400 m-0">
                      Available in shop: <strong className="text-white font-mono">{availableSealedBags} bags</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setBagQty((prev) => Math.max(1, prev - 1))}
                      disabled={bagQty <= 1}
                      className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={availableSealedBags || 9999}
                      value={bagQty}
                      onChange={(e) => setBagQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 text-center font-bold text-white font-mono bg-transparent text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setBagQty((prev) => prev + 1)}
                      disabled={bagQty >= availableSealedBags}
                      className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Preset Quick Bag Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setBagQty(num)}
                      disabled={num > availableSealedBags}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                        bagQty === num
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-700 disabled:opacity-30'
                      }`}
                    >
                      {num} Bag{num > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>

                {/* Subtotal preview */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    Total Weight: <strong className="text-amber-400 font-mono">{bagQty * bagWeight} kg</strong>
                  </span>
                  <span className="text-slate-300 font-mono">
                    Subtotal: <strong className="text-emerald-400 text-base">{currency}{totalBagPrice.toFixed(2)}</strong>
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={availableSealedBags < 1 || bagQty > availableSealedBags}
                onClick={handleAddBag}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  Add {bagQty} Sealed Bag{bagQty > 1 ? 's' : ''} to Bill • {currency}{totalBagPrice.toFixed(2)}
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: LOOSE RICE SELLING (BY KG) */}
          {activeTab === 'loose' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-300">Loose Rice Selling Rate</span>
                  <p className="text-[11px] text-amber-200/70 m-0">
                    Cost: {currency}{looseCostRate}/kg • Margin: <strong className="text-emerald-400">+{currency}{(looseRate - looseCostRate).toFixed(2)}/kg</strong>
                  </p>
                </div>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {currency}{looseRate.toFixed(2)} / kg
                </span>
              </div>

              {/* Container Status Note */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Open Loose Drum Stock:</span>
                  <strong className="text-amber-400 font-mono">{openBagLooseInStock} kg</strong>
                </div>
                <p className="text-[11px] text-slate-400 m-0">
                  {openBagLooseInStock > 0
                    ? `Scoops directly from the open drum. If you sell more than ${openBagLooseInStock} kg, the POS automatically cuts open 1 sealed bag.`
                    : `No open bag currently. Selling loose will automatically open 1 sealed bag (50 kg) and keep the remainder in loose stock.`}
                </p>
              </div>

              {/* Dual Inputs: KG or ₹ */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-2xl border transition ${
                  looseInputMode === 'weight'
                    ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-slate-800/60 border-slate-700'
                }`}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Enter Weight (kg)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={looseWeight}
                      onFocus={() => setLooseInputMode('weight')}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      placeholder="e.g. 2.0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-white focus:outline-none focus:border-indigo-500 pr-8"
                    />
                    <span className="absolute right-3 text-xs font-bold text-slate-400">kg</span>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border transition ${
                  looseInputMode === 'amount'
                    ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-slate-800/60 border-slate-700'
                }`}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cash Budget ({currency})
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">{currency}</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={looseAmount}
                      onFocus={() => setLooseInputMode('amount')}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-base font-bold font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Weight Presets */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Quick Weight Shortcuts:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0.5, 1, 2, 3, 5, 10, 25].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleWeightChange(String(w))}
                      disabled={w > totalAvailableKg}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                        parseFloat(looseWeight) === w
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30'
                      }`}
                    >
                      {w} kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Customer Cash Shortcuts:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[30, 60, 100, 150, 300, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleAmountChange(String(amt))}
                      className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      {currency}{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary line */}
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Calculated: <strong className="text-white">{parseFloat(looseWeight) || 0} kg</strong> @ {currency}{looseRate}/kg
                </span>
                <span className="text-emerald-400 font-bold text-sm">
                  = {currency}{totalLoosePrice.toFixed(2)}
                </span>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={
                  totalAvailableKg <= 0 ||
                  !parseFloat(looseWeight) ||
                  parseFloat(looseWeight) <= 0 ||
                  parseFloat(looseWeight) > totalAvailableKg
                }
                onClick={handleAddLoose}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  Add {parseFloat(looseWeight) || 0} kg Loose to Bill • {currency}{totalLoosePrice.toFixed(2)}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
