import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Share2,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Truck
} from 'lucide-react';
import ProductIcon from '../components/ProductIcon';
import TiltCard from '../components/TiltCard';
import { api } from '../services/api';

export default function StorefrontView({ settings, products = [], user, isPreview = false }) {
  const [storeData, setStoreData] = useState(null);
  const [storeProducts, setStoreProducts] = useState(products);
  const [loading, setLoading] = useState(!isPreview && !!user?.email);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Customer order form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const shopEmail = user?.email || settings?.owner_email || 'default';
  const shopName = settings?.shop_name || user?.shop_name || 'MS Store';
  const shopPhone = settings?.phone || user?.phone || '';
  const currency = settings?.currency_symbol || '₹';
  const address = settings?.address || '';
  const tagline = settings?.tagline || 'Fresh stock delivered directly to your doorstep';

  // Shareable link
  const storefrontUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('store', shopEmail);
      url.searchParams.set('view', 'catalog');
      return url.toString();
    }
    return '';
  }, [shopEmail]);

  useEffect(() => {
    if (products && products.length > 0) {
      setStoreProducts(products.filter((p) => p.stock_quantity > 0));
    }
  }, [products]);

  // Categories list
  const categories = useMemo(() => {
    const list = storeProducts.map((p) => p.category).filter(Boolean);
    return ['All', ...new Set(list)];
  }, [storeProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [storeProducts, search, selectedCategory]);

  // Cart operations
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert(`Maximum stock available: ${product.stock_quantity} ${product.unit || 'units'}`);
          return prev;
        }
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === productId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.id !== productId));
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Copy Store Link
  const copyStoreLink = () => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(storefrontUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Submit Order via WhatsApp & MS Store Cloud
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert('Please fill in your Name, Phone Number, and Delivery Address.');
      return;
    }

    try {
      setSubmittingOrder(true);

      // 1. Build WhatsApp message text
      let waMessage = `*🛍️ NEW ORDER for ${shopName}*\n`;
      waMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      waMessage += `*Customer:* ${customerName.trim()}\n`;
      waMessage += `*Phone:* ${customerPhone.trim()}\n`;
      waMessage += `*Delivery Address:* ${customerAddress.trim()}\n`;
      if (orderNotes.trim()) {
        waMessage += `*Notes:* ${orderNotes.trim()}\n`;
      }
      waMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      waMessage += `*Order Items:*\n`;

      cart.forEach((item, index) => {
        const itemTotal = (item.selling_price * item.quantity).toFixed(2);
        waMessage += `${index + 1}. *${item.name}* x ${item.quantity} ${item.unit || ''} = ${currency}${itemTotal}\n`;
      });

      waMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      waMessage += `*Total Amount:* *${currency}${cartSubtotal.toFixed(2)}*\n`;
      waMessage += `*Payment Mode:* Cash on Delivery / UPI on Delivery\n`;
      waMessage += `\n_Placed via MS Store Online Catalog_`;

      // 2. Submit to MS Store Backend
      let createdOrder = null;
      try {
        createdOrder = await api.createPublicOrder({
          store_email: shopEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
        });
      } catch (err) {
        console.warn('Backend sync warning:', err);
      }

      // 3. Open WhatsApp link
      const cleanPhone = shopPhone.replace(/[^\d]/g, '');
      const encodedMessage = encodeURIComponent(waMessage);
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      window.open(waUrl, '_blank');

      setCompletedOrder({
        invoice_no: createdOrder?.invoice_no || `WA-${Date.now().toString().slice(-6)}`,
        items: [...cart],
        total: cartSubtotal,
        customerName,
        customerPhone,
        customerAddress,
        waUrl,
      });

      setCart([]);
      setIsCartOpen(false);
    } catch (err) {
      alert(`Order error: ${err.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Shop Banner / Merchant Share Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-500/20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span className="font-semibold">Online WhatsApp Storefront & Digital Menu</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyStoreLink}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition font-semibold"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Store Link'}</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Order directly from ${shopName} online! View our catalog and order on WhatsApp here: ${storefrontUrl}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition font-semibold shadow-md shadow-emerald-600/30"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Direct Neighborhood Delivery</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight m-0">{shopName}</h1>
            <p className="text-slate-400 text-sm max-w-lg m-0">{tagline}</p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-slate-400">
              {shopPhone && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp: {shopPhone}</span>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>{address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Cart Status Widget */}
          <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 min-w-[200px]">
            <span className="text-xs text-slate-400">Your Basket</span>
            <p className="text-2xl font-black text-emerald-400 font-mono m-0">
              {currency}{cartSubtotal.toFixed(2)}
            </p>
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full mt-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>View Cart ({cartItemCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Catalog View */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products in catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800/80">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No products found</p>
            <p className="text-xs text-slate-500">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const inCart = cart.find((i) => i.id === p.id);
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 shadow-lg flex flex-col justify-between transition-all duration-200"
                >
                  <div>
                    {/* Icon & Category */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                        <ProductIcon category={p.category} className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-800/80">
                        {p.category}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight mb-1 m-0">
                      {p.name}
                    </h3>
                    <span className="text-[11px] text-slate-500 block mb-3 font-mono">
                      In Stock: {p.stock_quantity} {p.unit || 'units'}
                    </span>
                  </div>

                  {/* Pricing and Cart Buttons */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {currency}{parseFloat(p.selling_price).toFixed(2)}
                      </span>
                      {p.unit && (
                        <span className="text-[10px] text-slate-500 ml-1">/{p.unit}</span>
                      )}
                    </div>

                    {inCart ? (
                      <div className="flex items-center gap-1.5 bg-emerald-600/20 border border-emerald-500/40 rounded-xl p-0.5">
                        <button
                          onClick={() => updateQuantity(p.id, -1)}
                          className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 text-xs font-bold text-white font-mono">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(p.id, 1)}
                          className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-xs font-bold border border-slate-700 hover:border-emerald-500 flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar (on Mobile / Desktop) */}
      {cartItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-slideUp">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xl shadow-emerald-950/60 flex items-center justify-between border border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold font-mono text-sm">
                {cartItemCount}
              </div>
              <div className="text-left">
                <span className="text-xs font-semibold opacity-90 block">Items in Basket</span>
                <span className="text-sm font-black font-mono">{currency}{cartSubtotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider">
              <span>Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Slide-over / Modal Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white m-0">Your Order ({cartItemCount} items)</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate m-0">{item.name}</p>
                    <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                      {currency}{item.selling_price.toFixed(2)} each
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 font-mono font-bold text-white text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-rose-400 hover:text-rose-300 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Delivery Details Form */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span>Delivery Details</span>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Full Delivery Address *</label>
                  <textarea
                    required
                    rows="2"
                    placeholder="House/Flat No, Landmark, Street..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Special Order Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Call before arrival, leave at door"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Drawer Footer Checkout Button */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/95 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Order Amount</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {currency}{cartSubtotal.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submittingOrder || cart.length === 0}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>{submittingOrder ? 'Processing Order...' : 'Send Order via WhatsApp'}</span>
              </button>
              <p className="text-[10px] text-center text-slate-500 m-0">
                Opens your WhatsApp with your items pre-formatted to confirm with the store.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmed Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white m-0">Order Generated!</h3>
            <p className="text-xs text-slate-400 m-0">
              Invoice Ref: <span className="font-mono text-emerald-400 font-bold">{completedOrder.invoice_no}</span>
            </p>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{completedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Items:</span>
                <span className="font-semibold text-white">{completedOrder.items.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bill:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {currency}{completedOrder.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={completedOrder.waUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Re-open WhatsApp Message</span>
              </a>

              <button
                onClick={() => setCompletedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Continue Browsing Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
