import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Tag, DollarSign, Package, AlertTriangle, Layers, Upload, Image as ImageIcon, Smile, Trash2, Camera, Link as LinkIcon } from 'lucide-react';
import ProductIcon from './ProductIcon';

const EMOJI_OPTIONS = ['📦', '🖱️', '🔌', '⌨️', '🔊', '🍵', '🥛', '🍚', '🍯', '🧴', '💡', '📓', '🖊️', '🎧', '🍫', '🍎', '👕', '📱', '🧼', '☕'];

const compressImage = (file, maxSize = 256, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export default function ProductModal({ product, categories = [], currencySymbol = '₹', isOpen, onClose, onSave, allProducts = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'General',
    cost_price: '',
    selling_price: '',
    stock_quantity: '10',
    low_stock_threshold: '5',
    unit: 'pcs',
    image_emoji: '📦',
    gst_percentage: '5',
    is_bundle: false,
    bundle_items: [],
    is_grain_rice: false,
    bag_weight_kg: '50',
    open_bag_loose_kg: '0',
    bag_variants: [],
    allow_loose: true,
    loose_selling_price: '',
    loose_cost_price: '',
  });
  const [selectedCompId, setSelectedCompId] = useState('');
  const [selectedCompQty, setSelectedCompQty] = useState('1');

  // Rice & Grain bag pack state
  const [newBagWeight, setNewBagWeight] = useState('26');
  const [newBagLabel, setNewBagLabel] = useState('26 kg Bag');
  const [newBagSellPrice, setNewBagSellPrice] = useState('');
  const [newBagCostPrice, setNewBagCostPrice] = useState('');

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [iconTab, setIconTab] = useState('upload'); // 'upload' | 'emoji' | 'url'
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        category: product.category || 'General',
        cost_price: String(product.cost_price ?? ''),
        selling_price: String(product.selling_price ?? ''),
        stock_quantity: String(product.stock_quantity ?? 0),
        low_stock_threshold: String(product.low_stock_threshold ?? 5),
        unit: product.unit || (product.is_grain_rice ? 'bags' : 'pcs'),
        image_emoji: product.image_emoji || (product.is_grain_rice ? '🍚' : '📦'),
        gst_percentage: String(product.gst_percentage ?? 5),
        is_bundle: Boolean(product.is_bundle),
        bundle_items: Array.isArray(product.bundle_items) ? product.bundle_items : [],
        is_grain_rice: Boolean(product.is_grain_rice),
        bag_weight_kg: String(product.bag_weight_kg ?? 50),
        open_bag_loose_kg: String(product.open_bag_loose_kg ?? 0),
        bag_variants: Array.isArray(product.bag_variants) ? product.bag_variants : [],
        allow_loose: product.allow_loose !== undefined ? Boolean(product.allow_loose) : true,
        loose_selling_price: product.loose_selling_price != null ? String(product.loose_selling_price) : '',
        loose_cost_price: product.loose_cost_price != null ? String(product.loose_cost_price) : '',
      });
    } else {
      // Auto generate a SKU for new product
      const randomSku = 'PROD-' + Math.floor(1000 + Math.random() * 9000);
      setFormData({
        name: '',
        sku: randomSku,
        category: categories[0] || 'General',
        cost_price: '',
        selling_price: '',
        stock_quantity: '15',
        low_stock_threshold: '5',
        unit: 'pcs',
        image_emoji: '📦',
        gst_percentage: '5',
        is_bundle: false,
        bundle_items: [],
        is_grain_rice: false,
        bag_weight_kg: '50',
        open_bag_loose_kg: '0',
        bag_variants: [],
        allow_loose: true,
        loose_selling_price: '',
        loose_cost_price: '',
      });
    }
    setError('');
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  // Clean parse helper
  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return NaN;
    const clean = String(val).replace(/,/g, '.').trim();
    return parseFloat(clean);
  };

  const cost = parseNum(formData.cost_price);
  const sell = parseNum(formData.selling_price);
  const validCost = !isNaN(cost) && cost >= 0 ? cost : 0;
  const validSell = !isNaN(sell) && sell >= 0 ? sell : 0;
  const margin = validSell > 0 ? (((validSell - validCost) / validSell) * 100).toFixed(1) : '0.0';
  const profitPerItem = (validSell - validCost).toFixed(2);

  // Available component candidates (exclude self and other bundles to prevent recursion)
  const candidateProducts = allProducts.filter((p) => (!product || p.id !== product.id) && !p.is_bundle);

  // Add component item to bundle
  const handleAddBundleComponent = () => {
    const comp = candidateProducts.find((p) => p.id === Number(selectedCompId));
    if (!comp) return;

    const qty = parseFloat(selectedCompQty) || 1;
    if (qty <= 0) return;

    const existingIdx = formData.bundle_items.findIndex((item) => item.product_id === comp.id);
    let nextBundleItems = [...formData.bundle_items];

    if (existingIdx >= 0) {
      nextBundleItems[existingIdx].quantity += qty;
    } else {
      nextBundleItems.push({
        product_id: comp.id,
        name: comp.name,
        sku: comp.sku,
        unit: comp.unit || 'pcs',
        cost_price: parseFloat(comp.cost_price) || 0,
        selling_price: parseFloat(comp.selling_price) || 0,
        quantity: qty,
      });
    }

    // Recalculate component cost and standard price
    const compTotalCost = nextBundleItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
    const compTotalSell = nextBundleItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);

    // Compute max bundles packable from stock
    const possibleStock = Math.min(
      ...nextBundleItems.map((bi) => {
        const prodMatch = allProducts.find((p) => p.id === bi.product_id);
        const avail = prodMatch ? parseFloat(prodMatch.stock_quantity) : 0;
        return Math.floor(avail / (bi.quantity || 1));
      })
    );

    setFormData((prev) => ({
      ...prev,
      bundle_items: nextBundleItems,
      cost_price: compTotalCost.toFixed(2),
      selling_price: prev.selling_price || (compTotalSell * 0.9).toFixed(2), // default 10% combo discount
      stock_quantity: String(Number.isFinite(possibleStock) ? Math.max(0, possibleStock) : 10),
    }));

    setSelectedCompId('');
    setSelectedCompQty('1');
  };

  const handleRemoveBundleComponent = (prodId) => {
    const nextBundleItems = formData.bundle_items.filter((item) => item.product_id !== prodId);
    const compTotalCost = nextBundleItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);

    setFormData((prev) => ({
      ...prev,
      bundle_items: nextBundleItems,
      cost_price: compTotalCost.toFixed(2),
    }));
  };

  // Rice & Grain bag variants helper functions
  const handleAddBagVariant = () => {
    const weight = parseFloat(newBagWeight);
    if (isNaN(weight) || weight <= 0) {
      setError('Please enter a valid bag weight in kg (e.g. 5, 10, 26, 50, 75).');
      return;
    }
    const sellPrice = parseFloat(newBagSellPrice) || (validSell > 0 ? Math.round(validSell * weight) : 0);
    const costPrice = parseFloat(newBagCostPrice) || (validCost > 0 ? Math.round(validCost * weight) : 0);
    const label = newBagLabel.trim() || (weight === 26 ? '26 kg Bag (Standard)' : `${weight} kg Bag`);

    const newVariant = {
      id: `bag-${weight}`,
      weight_kg: weight,
      label,
      selling_price: sellPrice,
      cost_price: costPrice,
    };

    setFormData((prev) => {
      const existing = (prev.bag_variants || []).filter((b) => parseFloat(b.weight_kg) !== weight);
      return {
        ...prev,
        bag_variants: [...existing, newVariant].sort((a, b) => a.weight_kg - b.weight_kg),
      };
    });

    setNewBagWeight('');
    setNewBagLabel('');
    setNewBagSellPrice('');
    setNewBagCostPrice('');
  };

  const handleRemoveBagVariant = (variantId) => {
    setFormData((prev) => ({
      ...prev,
      bag_variants: (prev.bag_variants || []).filter((b) => b.id !== variantId),
    }));
  };

  const handleAddStandardRiceBags = () => {
    const baseSell = validSell > 0 ? validSell : 60;
    const baseCost = validCost > 0 ? validCost : 50;

    const standardWeights = [5, 10, 26, 50, 75];
    const standardBags = standardWeights.map((w) => {
      let discountFactor = 1.0;
      if (w === 10) discountFactor = 0.98;
      else if (w === 26) discountFactor = 0.96;
      else if (w === 50) discountFactor = 0.94;
      else if (w === 75) discountFactor = 0.92;

      const sp = Math.round(baseSell * w * discountFactor);
      const cp = Math.round(baseCost * w * discountFactor);

      return {
        id: `bag-${w}`,
        weight_kg: w,
        label: w === 26 ? '26 kg Bag (Standard)' : `${w} kg Bag`,
        selling_price: sp,
        cost_price: cp,
      };
    });

    setFormData((prev) => ({
      ...prev,
      bag_variants: standardBags,
      unit: 'kg',
      image_emoji: prev.image_emoji === '📦' ? '🍚' : prev.image_emoji,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = formData.name.trim();
    const cleanSku = formData.sku.trim();

    if (!cleanName) {
      setError('Please enter a product name.');
      return;
    }

    if (!cleanSku) {
      setError('Please enter a valid SKU / Code.');
      return;
    }

    if (formData.is_bundle && (!formData.bundle_items || formData.bundle_items.length < 2)) {
      setError('A combo kit / bundle must include at least 2 component products.');
      return;
    }

    if (formData.is_grain_rice) {
      const bagWeight = parseFloat(formData.bag_weight_kg);
      if (isNaN(bagWeight) || bagWeight <= 0) {
        setError('Please enter a valid sealed bag weight in kg (e.g. 5, 10, 26, 50, 75).');
        return;
      }
      if (formData.allow_loose) {
        const loosePrice = parseFloat(formData.loose_selling_price);
        if (isNaN(loosePrice) || loosePrice <= 0) {
          setError('Please enter a valid loose selling rate per kg (e.g. ₹30/kg).');
          return;
        }
      }
    }

    if (isNaN(cost) || cost < 0) {
      setError('Please enter a valid cost price (0 or greater).');
      return;
    }

    if (isNaN(sell) || sell < 0) {
      setError('Please enter a valid selling price (0 or greater).');
      return;
    }

    const stockQty = parseFloat(String(formData.stock_quantity).trim());
    if (isNaN(stockQty) || stockQty < 0) {
      setError('Stock quantity must be a non-negative number.');
      return;
    }

    const threshold = parseInt(String(formData.low_stock_threshold).trim(), 10);
    const validThreshold = isNaN(threshold) || threshold < 1 ? 5 : threshold;

    try {
      setLoading(true);
      await onSave({
        name: cleanName,
        sku: cleanSku,
        category: formData.category ? formData.category.trim() : 'General',
        cost_price: cost,
        selling_price: sell,
        stock_quantity: stockQty,
        low_stock_threshold: validThreshold,
        unit: formData.is_grain_rice ? 'bags' : (formData.unit || (formData.is_bundle ? 'combo' : 'pcs')),
        image_emoji: formData.image_emoji || (formData.is_grain_rice ? '🍚' : (formData.is_bundle ? '🎁' : '📦')),
        gst_percentage: parseNum(formData.gst_percentage) || 0,
        is_bundle: Boolean(formData.is_bundle),
        bundle_items: formData.bundle_items || [],
        is_grain_rice: Boolean(formData.is_grain_rice),
        bag_weight_kg: formData.is_grain_rice ? (parseFloat(formData.bag_weight_kg) || 50) : 50,
        open_bag_loose_kg: formData.is_grain_rice ? (parseFloat(formData.open_bag_loose_kg) || 0) : 0,
        bag_variants: formData.is_grain_rice ? (formData.bag_variants || []) : [],
        allow_loose: formData.is_grain_rice ? Boolean(formData.allow_loose) : true,
        loose_selling_price: formData.is_grain_rice && formData.loose_selling_price ? parseFloat(formData.loose_selling_price) : null,
        loose_cost_price: formData.is_grain_rice && formData.loose_cost_price ? parseFloat(formData.loose_cost_price) : (formData.is_grain_rice && cost > 0 && parseFloat(formData.bag_weight_kg) > 0 ? parseFloat((cost / parseFloat(formData.bag_weight_kg)).toFixed(2)) : null),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const generateNewSku = () => {
    const prefix = formData.category ? formData.category.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') : 'SKU';
    setFormData((prev) => ({
      ...prev,
      sku: `${prefix || 'PROD'}-${Math.floor(1000 + Math.random() * 9000)}`,
    }));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image file is too large (maximum 15 MB).');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');
      const compressedDataUrl = await compressImage(file, 256, 0.85);
      setFormData((prev) => ({
        ...prev,
        image_emoji: compressedDataUrl,
      }));
    } catch (err) {
      console.error('Failed to compress image:', err);
      setError('Failed to process image. Please try another photo.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image_emoji: '📦',
    }));
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    setFormData((prev) => ({
      ...prev,
      image_emoji: customUrl.trim(),
    }));
    setCustomUrl('');
  };

  // Unique category suggestions
  const uniqueCategories = Array.from(
    new Set([...categories, 'Electronics', 'Groceries', 'Beverages', 'Lifestyle', 'Stationery', 'General'])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-indigo-500/20 rounded-xl border border-indigo-500/30 overflow-hidden">
              <ProductIcon icon={formData.image_emoji} className="w-10 h-10 object-cover" textClassName="text-2xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {product ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-slate-400">
                Update product information, pricing, and stock inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form with noValidate to prevent native browser regex failures */}
        <form noValidate onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector: Standard Product vs Rice / Grain Multi-Weight vs Combo Kit */}
          <div className="grid grid-cols-3 p-1 bg-slate-800/90 rounded-2xl border border-slate-700/80 gap-1">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  is_bundle: false,
                  is_grain_rice: false,
                  unit: prev.unit === 'combo' ? 'pcs' : prev.unit,
                }))
              }
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                !formData.is_bundle && !formData.is_grain_rice
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" /> Standard Item
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  is_grain_rice: true,
                  is_bundle: false,
                  unit: 'bags',
                  category: prev.category === 'General' ? 'Rice & Grains' : prev.category,
                  image_emoji: prev.image_emoji === '📦' ? '🍚' : prev.image_emoji,
                  bag_weight_kg: prev.bag_weight_kg || '50',
                  open_bag_loose_kg: prev.open_bag_loose_kg || '0',
                }));
              }}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                formData.is_grain_rice
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌾</span> Rice / Grain Bags
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  is_bundle: true,
                  is_grain_rice: false,
                  category: prev.category === 'General' ? 'Combos' : prev.category,
                  image_emoji: prev.image_emoji === '📦' ? '🎁' : prev.image_emoji,
                  unit: 'combo',
                }));
              }}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                formData.is_bundle
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🎁</span> Combo Pack
            </button>
          </div>

          {/* Rice & Grain Sealed Bag & Loose Selling Builder */}
          {formData.is_grain_rice && (
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 m-0">
                    <span>🌾</span> Rice Sealed Bag & Loose Selling Setup
                  </h4>
                  <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                    Track inventory in physical sealed bags. Sell whole bags or loose rice scooped from drum/bag.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold self-start sm:self-auto">
                  🎒 {formData.bag_weight_kg || 50} kg / bag
                </span>
              </div>

              {/* 1. Bag Weight Specification */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-amber-500/20 space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Sealed Bag Weight (kg per bag) *
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={formData.bag_weight_kg}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => {
                          const updated = { ...prev, bag_weight_kg: val };
                          const c = parseNum(prev.cost_price);
                          const w = parseFloat(val);
                          if (c > 0 && w > 0 && (!prev.loose_cost_price || prev.loose_cost_price === (c / (parseFloat(prev.bag_weight_kg) || 50)).toFixed(2))) {
                            updated.loose_cost_price = (c / w).toFixed(2);
                          }
                          return updated;
                        });
                      }}
                      placeholder="50"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500 text-center"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 font-mono">kg</span>
                  </div>

                  {/* Preset chips for popular weights */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 26, 50, 75].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            const updated = { ...prev, bag_weight_kg: String(w) };
                            const c = parseNum(prev.cost_price);
                            if (c > 0 && (!prev.loose_cost_price || prev.loose_cost_price === (c / (parseFloat(prev.bag_weight_kg) || 50)).toFixed(2))) {
                              updated.loose_cost_price = (c / w).toFixed(2);
                            }
                            return updated;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition ${
                          parseFloat(formData.bag_weight_kg) === w
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {w} kg {w === 50 ? '(Everest)' : w === 26 ? '(Standard)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Shop Floor Loose Drum Stock */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>⚖️</span> Loose Rice in Open Drum / Opened Bag (kg)
                  </label>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    {formData.open_bag_loose_kg || 0} kg ready to scoop
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-36">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.open_bag_loose_kg}
                      onChange={(e) => setFormData({ ...formData, open_bag_loose_kg: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500 text-center"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 font-mono">kg</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Remaining loose rice from already-opened bags. Set to 0 if all stock is in sealed bags.
                  </span>
                </div>
              </div>

              {/* 3. Loose Selling Rate & Margin */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.allow_loose}
                      onChange={(e) => setFormData({ ...formData, allow_loose: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                    />
                    <span className="text-xs font-bold text-white">
                      Allow Selling in Loose (per kg / grams)
                    </span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">
                    e.g. 1 kg = ₹30, 2 kg = ₹60, 500g = ₹15
                  </span>
                </div>

                {formData.allow_loose && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5 font-semibold">
                          Loose Selling Price ({currencySymbol} / kg) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-mono">{currencySymbol}</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={formData.loose_selling_price}
                            onChange={(e) => setFormData({ ...formData, loose_selling_price: e.target.value })}
                            placeholder="30.00"
                            className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          e.g. ₹30.00 per kg
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5 font-semibold">
                          Loose Cost Price ({currencySymbol} / kg)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-mono">{currencySymbol}</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={formData.loose_cost_price}
                            onChange={(e) => setFormData({ ...formData, loose_cost_price: e.target.value })}
                            placeholder={validCost > 0 && parseFloat(formData.bag_weight_kg) > 0 ? (validCost / parseFloat(formData.bag_weight_kg)).toFixed(2) : '28.00'}
                            className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Default: Bag Cost ÷ Bag Weight {validCost > 0 && parseFloat(formData.bag_weight_kg) > 0 ? `(${currencySymbol}${(validCost / parseFloat(formData.bag_weight_kg)).toFixed(2)}/kg)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Loose Profit Summary */}
                    {formData.loose_selling_price && (
                      <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-300">
                          Loose Rate: <strong className="text-emerald-400">{currencySymbol}{formData.loose_selling_price}/kg</strong>
                        </span>
                        {(() => {
                          const lSell = parseFloat(formData.loose_selling_price) || 0;
                          const lCost = parseFloat(formData.loose_cost_price) || (validCost > 0 && parseFloat(formData.bag_weight_kg) > 0 ? validCost / parseFloat(formData.bag_weight_kg) : 0);
                          const lProf = lSell - lCost;
                          const lMargin = lSell > 0 ? ((lProf / lSell) * 100).toFixed(1) : 0;
                          return (
                            <span className={lProf >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              Profit: {currencySymbol}{lProf.toFixed(2)} / kg ({lMargin}%)
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Automatic Bag Tear Note */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Automatic Bag Opening:</strong> When selling loose rice at checkout, it deducts from the open drum. If the drum runs empty, the POS automatically tears open 1 sealed bag ({formData.bag_weight_kg || 50} kg) and refills loose stock without interrupting checkout.
                </div>
              </div>
            </div>
          )}

          {/* Bundle Kit Components Builder */}
          {formData.is_bundle && (
            <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🎁</span> Bundle Component Items ({formData.bundle_items.length} added)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    When billed, stock will automatically deduct from these individual items
                  </p>
                </div>
              </div>

              {/* Add component row */}
              <div className="flex gap-2">
                <select
                  value={selectedCompId}
                  onChange={(e) => setSelectedCompId(e.target.value)}
                  className="flex-1 bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="">-- Choose product to bundle --</option>
                  {candidateProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) - {currencySymbol}{p.selling_price} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={selectedCompQty}
                  onChange={(e) => setSelectedCompQty(e.target.value)}
                  placeholder="Qty"
                  className="w-16 bg-slate-900 border border-purple-500/40 rounded-xl px-2 py-2 text-xs text-white text-center font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddBundleComponent}
                  disabled={!selectedCompId}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  Add
                </button>
              </div>

              {/* Component items list */}
              {formData.bundle_items.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {formData.bundle_items.map((bi) => (
                    <div
                      key={bi.product_id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{bi.quantity}x</span>
                        <span className="text-slate-200">{bi.name}</span>
                        <span className="text-[10px] text-slate-500">({bi.sku})</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-400 font-mono text-[11px]">
                          Cost: {currencySymbol}{(bi.cost_price * bi.quantity).toFixed(2)} | MRP: {currencySymbol}{(bi.selling_price * bi.quantity).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBundleComponent(bi.product_id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/20 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-purple-400/80 italic text-center py-2">
                  Select at least 2 items above to create a combo bundle pack (e.g. 1 Shampoo + 1 Conditioner).
                </p>
              )}
            </div>
          )}

          {/* Product Icon Selection (Gallery / Files / Emoji / URL) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Product Icon / Image
              </label>
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setIconTab('upload')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                    iconTab === 'upload' ? 'bg-indigo-600 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Gallery / Files
                </button>
                <button
                  type="button"
                  onClick={() => setIconTab('emoji')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                    iconTab === 'emoji' ? 'bg-indigo-600 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smile className="w-3.5 h-3.5" />
                  Emojis
                </button>
                <button
                  type="button"
                  onClick={() => setIconTab('url')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                    iconTab === 'url' ? 'bg-indigo-600 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  Web URL
                </button>
              </div>
            </div>

            {/* Hidden file input supporting camera & gallery */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {iconTab === 'upload' && (
              <div>
                {formData.image_emoji && (formData.image_emoji.startsWith('data:image') || formData.image_emoji.startsWith('http') || formData.image_emoji.startsWith('/')) ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                    <img
                      src={formData.image_emoji}
                      alt="Product preview"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-600 shadow-md bg-slate-900"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Custom Image Attached
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Compressed & ready to save with product
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {uploadingImage ? 'Loading...' : 'Change'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition"
                        title="Remove custom image and reset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-800/40 hover:bg-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2 transition">
                      {uploadingImage ? (
                        <Sparkles className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-200">
                      {uploadingImage ? 'Compressing image...' : 'Click to select from Gallery or Files'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 text-center">
                      Upload from phone camera, photo gallery, or PC files (PNG, JPG, WebP)
                    </p>
                  </div>
                )}
              </div>
            )}

            {iconTab === 'emoji' && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 max-h-36 overflow-y-auto">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setFormData({ ...formData, image_emoji: emoji })}
                    className={`w-9 h-9 text-lg flex items-center justify-center rounded-lg transition ${
                      formData.image_emoji === emoji
                        ? 'bg-indigo-600 text-white shadow-md scale-110'
                        : 'hover:bg-slate-700/70 text-slate-300'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {iconTab === 'url' && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/product-image.png"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Paste any public direct image URL link
                </p>
              </div>
            )}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Wireless Mouse Pro"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* SKU & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">SKU / Code *</label>
                <button
                  type="button"
                  onClick={generateNewSku}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="ELEC-001"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category
              </label>
              <input
                type="text"
                list="category-suggestions-list"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Category"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <datalist id="category-suggestions-list">
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Pricing & Profit Calculator */}
          <div className="p-4 bg-slate-800/70 border border-slate-700 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                {formData.is_grain_rice ? 'Whole Sealed Bag Pricing' : 'Pricing & Profit Calculator'}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                  validSell >= validCost
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                Profit: {currencySymbol}{profitPerItem} {formData.is_grain_rice ? '/ bag' : ''} ({margin}%)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {formData.is_grain_rice ? 'Cost Price (Buy 1 Bag) *' : 'Cost Price (Buy Price) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => {
                        const updated = { ...prev, cost_price: val };
                        const c = parseFloat(val);
                        const w = parseFloat(prev.bag_weight_kg) || 50;
                        if (prev.is_grain_rice && c > 0 && w > 0 && !prev.loose_cost_price) {
                          updated.loose_cost_price = (c / w).toFixed(2);
                        }
                        return updated;
                      });
                    }}
                    placeholder={formData.is_grain_rice ? '1400.00' : '0.00'}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {formData.is_grain_rice ? 'Selling Price (Sell 1 Bag) *' : 'Selling Price (Retail) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder={formData.is_grain_rice ? '1450.00' : '0.00'}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-semibold text-emerald-400 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stock, Unit & Default GST Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {formData.is_grain_rice ? 'Stock of Sealed Bags *' : 'Stock Quantity *'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                placeholder={formData.is_grain_rice ? '50' : '10'}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
              />
              {formData.is_grain_rice && (
                <span className="text-[10px] text-amber-400/90 block mt-0.5 font-mono">
                  = {(parseFloat(formData.stock_quantity) || 0) * (parseFloat(formData.bag_weight_kg) || 50)} kg total
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {formData.is_grain_rice ? 'Low Bags Alert' : 'Low Stock Alert'}
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit</label>
              <select
                value={formData.is_grain_rice ? 'bags' : formData.unit}
                disabled={formData.is_grain_rice}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-85 disabled:cursor-not-allowed font-medium"
              >
                <option value="bags">bags (Sealed Bags)</option>
                <option value="pcs">pcs</option>
                <option value="box">box</option>
                <option value="pack">pack</option>
                <option value="kg">kg (Kilograms)</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="bottle">bottle</option>
                <option value="meter">meter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default GST %</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={formData.gst_percentage}
                  onChange={(e) => setFormData({ ...formData, gst_percentage: e.target.value })}
                  placeholder="5"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">%</span>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : product ? 'Update Product' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
