import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingBag, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, User, Phone, Tag, Check, Sparkles, AlertCircle, ExternalLink, Star, Award, MessageSquare, Scale } from 'lucide-react';
import TiltCard from '../components/TiltCard';
import ProductIcon from '../components/ProductIcon';
import StoreScene3D from '../components/StoreScene3D';
import ReceiptModal from '../components/ReceiptModal';
import VoiceBillingAssistant from '../components/VoiceBillingAssistant';
import CustomersModal from '../components/CustomersModal';
import RiceSelectorModal from '../components/RiceSelectorModal';
import { api } from '../services/api';

export default function BillingView({ products = [], categories = [], settings, onOrderCompleted, refreshProducts }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  // Rice & Grain packaging selector modal
  const [selectedRiceProduct, setSelectedRiceProduct] = useState(null);

  // Customer Loyalty state
  const [customerLoyalty, setCustomerLoyalty] = useState(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState(0);
  const [showCustomersModal, setShowCustomersModal] = useState(false);

  // Multi-counter identification & live sync
  const [activeCounter, setActiveCounter] = useState(() => {
    try {
      return localStorage.getItem('ms_store_active_counter') || 'Counter 1 (Main)';
    } catch {
      return 'Counter 1 (Main)';
    }
  });
  const [syncAlert, setSyncAlert] = useState('');

  const currency = settings?.currency_symbol || '₹';
  const taxPercentage = settings?.tax_percentage || 5.0;

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  // Cart operations
  const addToCart = (product, quantity = 1) => {
    // If grain/rice product, open quick packaging & weight selector modal
    if (product.is_grain_rice) {
      setSelectedRiceProduct(product);
      return;
    }

    const isBundle = Boolean(product.is_bundle);
    if (!isBundle && product.stock_quantity <= 0) return;
    const addCount = Math.max(0.1, quantity);
    const cartKey = String(product.id);

    setCart((prev) => {
      const existing = prev.find((item) => (item.cartKey || item.id) === cartKey);
      if (existing) {
        if (!isBundle && existing.quantity + addCount > product.stock_quantity) {
          setError(`Cannot add more than available stock (${product.stock_quantity} ${product.unit}).`);
          setTimeout(() => setError(''), 3000);
          return prev;
        }
        return prev.map((item) =>
          (item.cartKey || item.id) === cartKey ? { ...item, quantity: item.quantity + addCount } : item
        );
      }
      const initialGst = product.gst_percentage !== undefined ? product.gst_percentage : (settings?.tax_percentage ?? 5.0);
      return [
        ...prev,
        {
          ...product,
          cartKey,
          stock_deduct_per_unit: 1,
          quantity: addCount,
          gst_percentage: initialGst,
        },
      ];
    });
  };

  // Dedicated Rice / Grain item handler
  const handleAddRiceItem = (riceItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => (item.cartKey || item.id) === riceItem.cartKey);
      const product = products.find((p) => p.id === riceItem.id);

      if (product) {
        const bagWt = parseFloat(product.bag_weight_kg) || parseFloat(riceItem.bag_weight) || 50;
        const totalStoreCapacityKg = (parseFloat(product.stock_quantity) || 0) * bagWt + (parseFloat(product.open_bag_loose_kg) || 0);

        const currentUsedKg = prev
          .filter((i) => i.id === riceItem.id)
          .reduce((sum, i) => {
            const weight = i.is_loose ? 1 : (parseFloat(i.bag_weight) || bagWt);
            return sum + (parseFloat(i.quantity) || 0) * weight;
          }, 0);

        const additionalKg = (parseFloat(riceItem.quantity) || 0) * (riceItem.is_loose ? 1 : (parseFloat(riceItem.bag_weight) || bagWt));
        const totalRequestedKg = currentUsedKg + additionalKg;

        if (totalRequestedKg > totalStoreCapacityKg) {
          setError(
            `Insufficient stock for "${product.name}"! Total store capacity: ${totalStoreCapacityKg} kg, Requested: ${totalRequestedKg} kg.`
          );
          setTimeout(() => setError(''), 4000);
          return prev;
        }

        // Also check if sealed bags requested exceed sealed bags available
        if (!riceItem.is_loose) {
          const currentBags = prev
            .filter((i) => i.id === riceItem.id && !i.is_loose)
            .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
          const availBags = parseFloat(product.stock_quantity) || 0;
          if (currentBags + parseFloat(riceItem.quantity) > availBags) {
            setError(`Insufficient sealed bags in stock! Available: ${availBags} bags.`);
            setTimeout(() => setError(''), 4000);
            return prev;
          }
        }
      }

      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: parseFloat((item.quantity + riceItem.quantity).toFixed(3)) }
            : item
        );
      }

      return [...prev, riceItem];
    });
  };

  const updateItemGst = (cartKey, newGst) => {
    setCart((prev) =>
      prev.map((item) =>
        (item.cartKey || item.id) === cartKey ? { ...item, gst_percentage: newGst } : item
      )
    );
  };

  const updateQuantity = (cartKey, delta) => {
    setCart((prev) => {
      const target = prev.find((i) => (i.cartKey || i.id) === cartKey);
      if (!target) return prev;

      const nextQty = parseFloat((target.quantity + delta).toFixed(3));
      if (nextQty <= 0) {
        return prev.filter((i) => (i.cartKey || i.id) !== cartKey);
      }

      // Check stock pool limit
      const product = products.find((p) => p.id === target.id);
      if (product && !product.is_bundle) {
        if (product.is_grain_rice) {
          const bagWt = parseFloat(product.bag_weight_kg) || parseFloat(target.bag_weight) || 50;
          const totalStoreCapacity = (parseFloat(product.stock_quantity) || 0) * bagWt + (parseFloat(product.open_bag_loose_kg) || 0);
          const totalUsedKg = prev
            .filter((i) => i.id === target.id)
            .reduce((sum, i) => {
              const qty = (i.cartKey || i.id) === cartKey ? nextQty : i.quantity;
              const weight = i.is_loose ? 1 : (parseFloat(i.bag_weight) || bagWt);
              return sum + qty * weight;
            }, 0);

          if (totalUsedKg > totalStoreCapacity) {
            setError(`Insufficient store stock for "${product.name}". Total available: ${totalStoreCapacity} kg.`);
            setTimeout(() => setError(''), 3000);
            return prev;
          }
        } else {
          const currentStock = parseFloat(product.stock_quantity) || 0;
          if (nextQty > currentStock) {
            setError(`Maximum available stock is ${currentStock} ${product.unit || 'units'}.`);
            setTimeout(() => setError(''), 3000);
            return prev;
          }
        }
      }

      return prev.map((item) =>
        (item.cartKey || item.id) === cartKey ? { ...item, quantity: nextQty } : item
      );
    });
  };

  const updateQuantityDirect = (cartKey, val) => {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) return;

    setCart((prev) => {
      const target = prev.find((i) => (i.cartKey || i.id) === cartKey);
      if (!target) return prev;

      const product = products.find((p) => p.id === target.id);
      if (product && !product.is_bundle) {
        const totalUsed = prev
          .filter((i) => i.id === target.id)
          .reduce((sum, i) => {
            const qty = (i.cartKey || i.id) === cartKey ? parsed : i.quantity;
            const deduct = parseFloat(i.stock_deduct_per_unit) || 1;
            return sum + qty * deduct;
          }, 0);

        if (totalUsed > parseFloat(product.stock_quantity)) {
          setError(`Maximum available stock pool is ${product.stock_quantity} ${product.unit || 'units'}.`);
          setTimeout(() => setError(''), 3000);
          return prev;
        }
      }

      return prev.map((item) =>
        (item.cartKey || item.id) === cartKey ? { ...item, quantity: parsed } : item
      );
    });
  };

  const removeFromCart = (cartKey) => {
    setCart((prev) => prev.filter((item) => (item.cartKey || item.id) !== cartKey));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerLoyalty(null);
    setRedeemLoyalty(false);
    setRedeemPointsAmount(0);
  };

  // Loyalty Settings
  const loyaltyEnabled = settings?.loyalty_enabled !== false;
  const pointsPer100 = parseFloat(settings?.loyalty_points_per_100) || 1;
  const pointValue = parseFloat(settings?.loyalty_point_value) || 1.0;
  const minPointsToRedeem = parseFloat(settings?.loyalty_min_points_to_redeem) || 5;

  // Auto-lookup customer by phone
  useEffect(() => {
    const trimmed = (customerPhone || '').trim();
    if (trimmed.length < 5) {
      setCustomerLoyalty(null);
      setRedeemLoyalty(false);
      setRedeemPointsAmount(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLookingUpCustomer(true);
        const found = await api.lookupCustomer(trimmed);
        if (found) {
          setCustomerLoyalty(found);
          if (!customerName && found.name) {
            setCustomerName(found.name);
          }
        } else {
          setCustomerLoyalty(null);
        }
      } catch (err) {
        console.warn('Customer lookup error:', err);
      } finally {
        setLookingUpCustomer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerPhone]);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.selling_price * item.quantity, 0);
  const totalCost = cart.reduce((acc, item) => acc + item.cost_price * item.quantity, 0);
  const manualDiscountAmount = Math.min(subtotal, Math.max(0, parseFloat(discount) || 0));

  // Loyalty Points Discount Calculation
  const maxRedeemablePoints = loyaltyEnabled && customerLoyalty?.points_balance > 0
    ? Math.min(
        Math.floor(customerLoyalty.points_balance),
        Math.floor(Math.max(0, subtotal - manualDiscountAmount) / pointValue)
      )
    : 0;

  const activeRedeemedPoints = (redeemLoyalty && customerLoyalty?.points_balance >= minPointsToRedeem)
    ? Math.min(maxRedeemablePoints, Math.max(0, parseInt(redeemPointsAmount) || 0))
    : 0;

  const loyaltyDiscountAmount = activeRedeemedPoints * pointValue;
  const totalDiscount = manualDiscountAmount + loyaltyDiscountAmount;
  const discountRatio = subtotal > 0 ? Math.max(0, (subtotal - totalDiscount) / subtotal) : 1;

  // Itemized GST calculation
  const totalTaxAmount = cart.reduce((sum, item) => {
    const itemSubtotal = item.selling_price * item.quantity;
    const itemTaxable = itemSubtotal * discountRatio;
    const pct = parseFloat(item.gst_percentage) || 0;
    return sum + (itemTaxable * (pct / 100));
  }, 0);

  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const grandTotal = taxableAmount + totalTaxAmount;
  const estimatedProfit = taxableAmount - totalCost;

  // Prospective points to be earned from this bill
  const prospectivePointsEarned = loyaltyEnabled
    ? Math.floor((taxableAmount / 100) * pointsPer100)
    : 0;

  // Real-time synchronization to secondary Customer-Facing Display
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('ms_store_pos_channel');
      const payload = {
        type: 'CART_UPDATE',
        cart,
        subtotal,
        discount: totalDiscount,
        tax: totalTaxAmount,
        grandTotal,
        paymentMethod,
        shopName: settings?.shop_name || 'MS Store',
        currency,
        upiId: settings?.upi_id || (settings?.phone ? `${settings.phone}@upi` : ''),
      };
      channel.postMessage(payload);
      localStorage.setItem('ms_store_active_cart', JSON.stringify(payload));
      return () => channel.close();
    } catch {}
  }, [cart, subtotal, totalDiscount, totalTaxAmount, grandTotal, paymentMethod, settings, currency]);

  // Real-time Multi-Counter Sync Listener
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('ms_store_multicounter_sync');
      bc.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'COUNTER_SALE_COMPLETED' && data.counterName !== activeCounter) {
          if (refreshProducts) refreshProducts();
          setSyncAlert(`⚡ Real-Time Sync: [${data.counterName}] billed ${data.invoiceNo}! Inventory stock updated.`);
          setTimeout(() => setSyncAlert(''), 5000);
        }
      };
    } catch {}

    return () => {
      if (bc) bc.close();
    };
  }, [activeCounter, refreshProducts]);

  const handleCounterChange = (newCounter) => {
    setActiveCounter(newCounter);
    try {
      localStorage.setItem('ms_store_active_counter', newCounter);
    } catch {}
  };

  // Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      setProcessing(true);
      setError('');

      const orderPayload = {
        items: cart.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          gst_percentage: parseFloat(i.gst_percentage) || 0,
          bag_weight: i.bag_weight ? parseFloat(i.bag_weight) : null,
          is_loose: Boolean(i.is_loose),
          display_name: i.name,
          selling_price: parseFloat(i.selling_price),
          cost_price: parseFloat(i.cost_price),
        })),
        customer_name: customerName,
        customer_phone: customerPhone,
        discount_amount: manualDiscountAmount,
        payment_method: paymentMethod,
        tax_percentage: taxPercentage,
        counter_name: activeCounter,
        loyalty_points_earned: prospectivePointsEarned,
        loyalty_points_redeemed: activeRedeemedPoints,
        loyalty_discount_amount: loyaltyDiscountAmount,
      };

      const receipt = await api.createOrder(orderPayload);
      try {
        const channel = new BroadcastChannel('ms_store_pos_channel');
        channel.postMessage({ type: 'ORDER_COMPLETED', receipt });
        channel.close();
      } catch {}

      // Broadcast to other counters
      try {
        const syncChannel = new BroadcastChannel('ms_store_multicounter_sync');
        syncChannel.postMessage({
          type: 'COUNTER_SALE_COMPLETED',
          counterName: activeCounter,
          invoiceNo: receipt.invoiceNo || receipt.invoice_no,
          time: Date.now(),
        });
        syncChannel.close();
      } catch {}

      setLastReceipt(receipt);
      clearCart();
      if (onOrderCompleted) onOrderCompleted();
      if (refreshProducts) refreshProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 3D Header Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/20 shadow-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 z-10 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Point of Sale System</span>
            </div>

            {/* Active Counter Selector */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 font-medium">Counter:</span>
              <select
                value={activeCounter}
                onChange={(e) => handleCounterChange(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="Counter 1 (Main)" className="bg-slate-900 text-white">Counter 1 (Main)</option>
                <option value="Counter 2" className="bg-slate-900 text-white">Counter 2</option>
                <option value="Counter 3" className="bg-slate-900 text-white">Counter 3</option>
                <option value="Express Checkout" className="bg-slate-900 text-white">Express Checkout</option>
              </select>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight m-0">
            Quick Billing & Stock POS
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md m-0">
            Concurrent multi-counter checkout with zero-latency customer display sync & dynamic payment QR.
          </p>
        </div>

        {/* 3D Interactive Shop Scene Widget */}
        <div className="w-full md:w-64 h-36 relative flex items-center justify-center">
          <StoreScene3D className="w-full h-full" />
          <span className="absolute bottom-1 right-2 text-[10px] text-indigo-300/70 font-mono bg-slate-900/60 px-2 py-0.5 rounded">
            Interactive 3D Hub
          </span>
        </div>
      </div>

      {/* Real-time Multi-Counter Sync Alert Toast */}
      {syncAlert && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{syncAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncAlert('')}
            className="text-emerald-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-emerald-500/20 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Selection (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search, Voice Assistant & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {/* Hands-Free Voice Assistant */}
            <VoiceBillingAssistant
              products={products}
              onAddToCart={addToCart}
              onClearCart={clearCart}
            />

            {/* Category Select Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {['All', ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Cards Grid with 3D Tilt */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredProducts.map((product) => {
              const inStock = product.stock_quantity > 0;
              const isLow = product.stock_quantity <= product.low_stock_threshold && inStock;
              const inCartItems = cart.filter((i) => i.id === product.id);
              const inCart = inCartItems.length > 0;
              const inCartQty = inCartItems.reduce((acc, i) => acc + (parseFloat(i.quantity) || 0), 0);
              const isGrain = Boolean(product.is_grain_rice);

              return (
                <TiltCard
                  key={product.id}
                  onClick={() => {
                    if (isGrain) {
                      setSelectedRiceProduct(product);
                    } else if (inStock) {
                      addToCart(product);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                    !inStock && (!isGrain || (parseFloat(product.open_bag_loose_kg) || 0) <= 0)
                      ? 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                      : inCart
                      ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/90 border-slate-700/60 hover:border-slate-500/80 shadow-md'
                  }`}
                >
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden">
                      <ProductIcon icon={product.image_emoji} className="w-10 h-10 object-cover" textClassName="text-3xl" />
                    </div>

                    {/* Stock Available Badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono tracking-tight flex items-center gap-1 ${
                        !inStock && (!isGrain || (parseFloat(product.open_bag_loose_kg) || 0) <= 0)
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : isLow
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          !inStock && (!isGrain || (parseFloat(product.open_bag_loose_kg) || 0) <= 0) ? 'bg-rose-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                      />
                      {!inStock && (!isGrain || (parseFloat(product.open_bag_loose_kg) || 0) <= 0)
                        ? 'Out of stock'
                        : isGrain
                        ? `${product.stock_quantity} bags${parseFloat(product.open_bag_loose_kg) > 0 ? ` + ${parseFloat(product.open_bag_loose_kg).toFixed(1)}kg` : ''}`
                        : `${product.stock_quantity} ${product.unit || 'pcs'}`}
                    </span>
                  </div>

                  {/* Product Details */}
                  <div className="space-y-1 mb-3">
                    <h3 className="text-sm font-bold text-white line-clamp-1 m-0">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] text-slate-400 font-mono m-0">
                        {product.sku}
                      </p>
                      {product.is_bundle && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-0.5">
                          <span>🎁</span> Combo Pack
                        </span>
                      )}
                      {isGrain && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                          <span>🌾</span> Rice / Bags
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Add to Cart button */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      {isGrain ? (
                        <div>
                          <p className="text-xs font-black text-indigo-300 font-mono m-0">
                            {currency}{product.selling_price} <span className="text-[10px] font-normal text-slate-400">/bag</span>
                          </p>
                          <p className="text-[10px] font-bold text-amber-400 font-mono m-0">
                            Loose: {currency}{product.loose_selling_price || 30}/kg
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-black text-indigo-400 font-mono m-0">
                          {currency}{product.selling_price}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!inStock && !isGrain}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGrain) {
                          setSelectedRiceProduct(product);
                        } else {
                          addToCart(product);
                        }
                      }}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                        !inStock && !isGrain
                          ? 'bg-slate-800 text-slate-600'
                          : isGrain
                          ? 'bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 px-2.5'
                          : inCart
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white'
                      }`}
                      title={isGrain ? 'Select Bag Weight (5, 10, 26, 50, 75 kg) or Loose Weight' : 'Add to cart'}
                    >
                      {isGrain ? (
                        <>
                          <Scale className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold">{inCart ? `(${inCartItems.length})` : 'Packs'}</span>
                        </>
                      ) : inCart ? (
                        <span className="font-mono text-xs px-1">+{inCartQty}</span>
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </TiltCard>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-sm font-semibold">No products found</p>
                <p className="text-xs text-slate-500">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: POS Cart & Register (5 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl p-5 flex flex-col space-y-4 backdrop-blur-xl">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white m-0">Current Order</h3>
                  <p className="text-xs text-slate-400 m-0">
                    {cart.reduce((a, b) => a + b.quantity, 0)} items selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open('/?view=customer-display', 'CustomerDisplay', 'width=960,height=700')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-semibold flex items-center gap-1 transition"
                  title="Open secondary monitor customer screen"
                >
                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                  <span>Customer Screen</span>
                </button>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-slate-400 hover:text-rose-400 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-xs">Your cart is empty.</p>
                  <p className="text-[11px] text-slate-600">Click products on the left to add items.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const cartKey = item.cartKey || item.id;
                  const itemSubtotal = item.selling_price * item.quantity;
                  const itemTaxable = itemSubtotal * discountRatio;
                  const itemGst = parseFloat(item.gst_percentage) || 0;
                  const itemTax = itemTaxable * (itemGst / 100);
                  const isLoose = Boolean(item.is_loose);
                  const isBag = Boolean(item.bag_weight) && !isLoose;

                  return (
                    <div
                      key={cartKey}
                      className="p-3 bg-slate-800/70 rounded-2xl border border-slate-700/70 space-y-2 text-xs"
                    >
                      {/* Top Row: Product details, Qty, Subtotal & Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg overflow-hidden bg-slate-900/80 border border-slate-700/50">
                            <ProductIcon icon={item.image_emoji} className="w-7 h-7 object-cover" textClassName="text-base" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-slate-200 truncate m-0">{item.name}</p>
                              {item.is_bundle && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  🎁 Combo
                                </span>
                              )}
                              {isBag && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  🎒 {item.bag_weight} kg Bag
                                </span>
                              )}
                              {isLoose && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⚖️ Loose (kg)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-indigo-400 font-mono m-0">
                              {isLoose
                                ? `${currency}${item.selling_price}/kg × ${item.quantity} kg`
                                : isBag
                                ? `${currency}${item.selling_price} × ${item.quantity} Bag${item.quantity > 1 ? 's' : ''} (${(item.quantity * item.bag_weight).toFixed(item.quantity % 1 !== 0 ? 1 : 0)} kg)`
                                : `${currency}${item.selling_price} × ${item.quantity}`}
                            </p>
                            {item.is_bundle && Array.isArray(item.bundle_items) && item.bundle_items.length > 0 && (
                              <p className="text-[10px] text-purple-300/80 m-0 truncate">
                                Includes: {item.bundle_items.map((b) => `${b.quantity}x ${b.name}`).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Qty Controls with Decimal / Loose Weight Support */}
                        <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded-lg border border-slate-700">
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartKey, isLoose ? -0.5 : -1)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            step={isLoose ? 'any' : '1'}
                            min={isLoose ? '0.01' : '1'}
                            value={item.quantity}
                            onChange={(e) => updateQuantityDirect(cartKey, e.target.value)}
                            className="w-14 text-center font-bold text-white font-mono bg-transparent focus:outline-none focus:bg-slate-800 rounded text-xs"
                            title={isLoose ? 'Edit loose weight in kg (e.g. 1.5)' : 'Edit bag/item quantity'}
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartKey, isLoose ? 0.5 : 1)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <p className="font-bold text-white font-mono min-w-[50px] text-right m-0">
                          {currency}{itemSubtotal.toFixed(2)}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeFromCart(cartKey)}
                          className="text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bottom Row: Editable GST % for this product */}
                      <div className="pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/60 px-2.5 py-1.5 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            GST:
                          </span>
                          <div className="relative inline-flex items-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max="100"
                              value={item.gst_percentage ?? 0}
                              onChange={(e) => updateItemGst(cartKey, e.target.value)}
                              className="w-12 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[10px] text-slate-400 ml-1">%</span>
                          </div>

                          {/* Quick GST Preset Chips */}
                          <div className="flex items-center gap-0.5 ml-1">
                            {[0, 5, 12, 18, 28].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => updateItemGst(cartKey, pct)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                                  Number(item.gst_percentage) === pct
                                    ? 'bg-amber-500/25 border border-amber-500/50 text-amber-300 font-bold'
                                    : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-300 font-mono">
                          Tax: <strong className="text-amber-400">+{currency}{itemTax.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer Details Form & Loyalty Program */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">
                  Customer Details (Optional)
                </p>
                <button
                  type="button"
                  onClick={() => setShowCustomersModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Loyalty Directory</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Phone No."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {lookingUpCustomer && (
                    <span className="absolute right-2 top-2 text-[10px] text-amber-400 font-mono animate-pulse">
                      ...
                    </span>
                  )}
                </div>
              </div>

              {/* Active Customer Loyalty Card */}
              {customerLoyalty && (
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-slate-900 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-amber-300">
                        {customerLoyalty.name || 'Loyal Member'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-400">
                      {customerLoyalty.points_balance} pts ({currency}{(customerLoyalty.points_balance * pointValue).toFixed(2)})
                    </span>
                  </div>

                  {/* Redemption Checkbox & Input */}
                  {loyaltyEnabled && customerLoyalty.points_balance >= minPointsToRedeem ? (
                    <div className="pt-1.5 border-t border-amber-500/20 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                        <input
                          type="checkbox"
                          checked={redeemLoyalty}
                          onChange={(e) => {
                            setRedeemLoyalty(e.target.checked);
                            if (e.target.checked && redeemPointsAmount === 0) {
                              setRedeemPointsAmount(maxRedeemablePoints);
                            }
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                        />
                        <span className="text-[11px] font-semibold text-amber-200">
                          Redeem points for discount
                        </span>
                      </label>

                      {redeemLoyalty && (
                        <div className="flex items-center gap-2 pl-5">
                          <input
                            type="number"
                            min="1"
                            max={maxRedeemablePoints}
                            value={redeemPointsAmount}
                            onChange={(e) => setRedeemPointsAmount(Math.min(maxRedeemablePoints, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-16 px-2 py-0.5 bg-slate-900 border border-amber-500/50 rounded-lg text-xs font-mono text-amber-300 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400">
                            = <strong className="text-emerald-400 font-mono">-{currency}{loyaltyDiscountAmount.toFixed(2)}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setRedeemPointsAmount(maxRedeemablePoints)}
                            className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold border border-amber-500/30 ml-auto"
                          >
                            Max ({maxRedeemablePoints})
                          </button>
                        </div>
                      )}
                    </div>
                  ) : customerLoyalty.points_balance < minPointsToRedeem ? (
                    <p className="text-[10px] text-slate-400 m-0 pl-1">
                      Min {minPointsToRedeem} pts required to redeem (Customer has: {customerLoyalty.points_balance}).
                    </p>
                  ) : null}
                </div>
              )}

              {/* Prospective Points Earning Banner */}
              {loyaltyEnabled && prospectivePointsEarned > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span>
                    Customer will earn <strong className="text-amber-300 font-mono">+{prospectivePointsEarned}</strong> loyalty points on this purchase!
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Payment Method
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', label: 'Cash', icon: Banknote },
                  { id: 'UPI', label: 'UPI/QR', icon: QrCode },
                  { id: 'Card', label: 'Card', icon: CreditCard },
                  { id: 'Credit', label: 'Credit', icon: Tag },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 border text-center transition ${
                        paymentMethod === pm.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic UPI QR Code on Screen */}
              {paymentMethod === 'UPI' && grandTotal > 0 && (
                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 space-y-2.5 animate-fadeIn text-center">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                      <QrCode className="w-4 h-4" />
                      <span>Dynamic UPI QR (Pre-filled)</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-extrabold text-sm">
                      {currency}{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-2xl inline-block shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=${encodeURIComponent(
                          settings?.upi_id || (settings?.phone ? `${settings.phone}@upi` : 'merchant@upi')
                        )}&pn=${encodeURIComponent(settings?.shop_name || 'MS Store')}&am=${grandTotal.toFixed(
                          2
                        )}&cu=INR&tn=Invoice%20Payment`
                      )}`}
                      alt="Dynamic UPI QR"
                      className="w-32 h-32 mx-auto object-contain"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 m-0">
                    Customer scans with GPay, PhonePe, or Paytm. Exact amount is automatically entered!
                  </p>
                </div>
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="p-3.5 bg-slate-800/50 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-white">{currency}{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between text-slate-400">
                <span>Discount ({currency})</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-right text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Loyalty Discount Line */}
              {loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    Loyalty Discount (-{activeRedeemedPoints} pts)
                  </span>
                  <span className="font-mono text-emerald-400">-{currency}{loyaltyDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400">
                <span>GST / Tax (Itemized)</span>
                <span className="font-mono text-amber-400 font-bold">+{currency}{totalTaxAmount.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-700 flex justify-between items-center text-sm font-black text-white">
                <span>Grand Total</span>
                <span className="text-xl font-mono text-indigo-400">
                  {currency}{grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Live Profit Preview for Owner */}
              {cart.length > 0 && (
                <div className="pt-1 text-[11px] flex justify-between text-emerald-400 font-semibold">
                  <span>Est. Profit from this sale:</span>
                  <span className="font-mono">+{currency}{estimatedProfit.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              disabled={cart.length === 0 || processing}
              onClick={handleCheckout}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-600/30 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <span>Processing Order...</span>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Generate Bill ({currency}{grandTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Printable / WhatsApp Receipt Modal */}
      {lastReceipt && (
        <ReceiptModal
          receipt={lastReceipt}
          settings={settings}
          onClose={() => setLastReceipt(null)}
        />
      )}

      {/* Customer Loyalty Directory Modal */}
      {showCustomersModal && (
        <CustomersModal
          settings={settings}
          onClose={() => setShowCustomersModal(false)}
          onCustomerSelect={(cust) => {
            setCustomerName(cust.name || '');
            setCustomerPhone(cust.phone || '');
            setCustomerLoyalty(cust);
            setShowCustomersModal(false);
          }}
        />
      )}

      {/* Rice & Grain Multi-Weight Bag & Loose Selector Modal */}
      {selectedRiceProduct && (
        <RiceSelectorModal
          isOpen={Boolean(selectedRiceProduct)}
          product={selectedRiceProduct}
          currencySymbol={currency}
          cartItems={cart}
          onClose={() => setSelectedRiceProduct(null)}
          onAddToCart={handleAddRiceItem}
        />
      )}
    </div>
  );
}
