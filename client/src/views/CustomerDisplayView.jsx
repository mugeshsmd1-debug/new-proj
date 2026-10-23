import React, { useState, useEffect } from 'react';
import { ShoppingBag, QrCode, Sparkles, CheckCircle2, ShieldCheck, Heart } from 'lucide-react';

export default function CustomerDisplayView({ settings }) {
  const [displayData, setDisplayData] = useState({
    cart: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    grandTotal: 0,
    paymentMethod: 'Cash',
    shopName: settings?.shop_name || 'MS Store',
    tagline: settings?.tagline || 'Thank you for shopping with us!',
    currency: settings?.currency_symbol || '₹',
    upiId: settings?.upi_id || settings?.phone ? `${settings.phone}@upi` : '',
    completedReceipt: null,
  });

  useEffect(() => {
    // 1. Check localStorage for initial cart
    try {
      const stored = localStorage.getItem('ms_store_active_cart');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDisplayData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}

    // 2. Listen to real-time BroadcastChannel updates from POS cashier window
    let channel = null;
    try {
      channel = new BroadcastChannel('ms_store_pos_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'CART_UPDATE') {
          setDisplayData((prev) => ({
            ...prev,
            cart: event.data.cart || [],
            subtotal: event.data.subtotal || 0,
            discount: event.data.discount || 0,
            tax: event.data.tax || 0,
            grandTotal: event.data.grandTotal || 0,
            paymentMethod: event.data.paymentMethod || 'Cash',
            completedReceipt: null,
          }));
        } else if (event.data?.type === 'ORDER_COMPLETED') {
          setDisplayData((prev) => ({
            ...prev,
            cart: [],
            grandTotal: 0,
            completedReceipt: event.data.receipt,
          }));
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, []);

  const currency = displayData.currency || settings?.currency_symbol || '₹';
  const shopName = displayData.shopName || settings?.shop_name || 'MS Store';
  const upiId = displayData.upiId || settings?.upi_id || 'store@upi';

  // Dynamic UPI QR code URL
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    shopName
  )}&am=${displayData.grandTotal.toFixed(2)}&cu=INR&tn=Store%20Bill`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    upiUri
  )}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-xl shadow-indigo-600/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight m-0">{shopName}</h1>
            <p className="text-slate-400 text-sm m-0">Customer Checkout Screen</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span>Live POS Sync</span>
        </div>
      </header>

      {/* Main Content Body */}
      {displayData.completedReceipt ? (
        /* Thank you Screen after Checkout */
        <div className="my-auto text-center space-y-4 max-w-lg mx-auto py-12 animate-fadeIn">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white m-0">Payment Successful!</h2>
          <p className="text-slate-400 text-sm m-0">
            Thank you for shopping at <strong className="text-white">{shopName}</strong>.
          </p>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-mono inline-block">
            Invoice: <span className="text-indigo-400 font-bold">{displayData.completedReceipt.invoiceNo || displayData.completedReceipt.invoice_no}</span> • Total Paid: <span className="text-emerald-400 font-bold">{currency}{Number(displayData.completedReceipt.total_amount || 0).toFixed(2)}</span>
          </div>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Please collect your printed receipt</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
          </p>
        </div>
      ) : displayData.cart.length === 0 ? (
        /* Idle / Welcome Screen */
        <div className="my-auto text-center space-y-4 py-16 animate-fadeIn">
          <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600 shadow-2xl">
            <ShoppingBag className="w-12 h-12 text-indigo-400 animate-pulse" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white m-0">Welcome to {shopName}</h2>
          <p className="text-slate-400 text-base max-w-md mx-auto m-0">
            Items will appear here live as they are scanned by the cashier.
          </p>
        </div>
      ) : (
        /* Active Cart Display */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-4">
          {/* Scanned Items List (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between max-h-[550px] overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Scanned Items ({displayData.cart.length})
              </span>
              <span className="text-xs text-slate-500 font-mono">Real-time scan</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {displayData.cart.map((item) => (
                <div
                  key={item.cartKey || item.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-base font-bold text-white truncate m-0">{item.name}</p>
                    <span className="text-xs text-slate-400 font-mono">
                      {currency}{Number(item.selling_price).toFixed(2)} x {item.quantity} {item.unit || ''}
                      {item.bag_weight && ` (${(item.quantity * item.bag_weight).toFixed(item.quantity % 1 !== 0 ? 1 : 0)} kg total)`}
                    </span>
                  </div>
                  <span className="text-lg font-black text-white font-mono">
                    {currency}{(Number(item.selling_price) * Number(item.quantity)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Subtotals */}
            <div className="pt-4 border-t border-slate-800 mt-4 space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono text-white">{currency}{displayData.subtotal.toFixed(2)}</span>
              </div>
              {displayData.discount > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Discount Savings:</span>
                  <span className="font-mono">-{currency}{displayData.discount.toFixed(2)}</span>
                </div>
              )}
              {displayData.tax > 0 && (
                <div className="flex justify-between">
                  <span>Taxes (GST):</span>
                  <span className="font-mono text-white">+{currency}{displayData.tax.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment & QR Code Panel (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-indigo-950/50 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-between text-center">
            <div className="w-full">
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400 block mb-1">
                Amount Payable
              </span>
              <p className="text-4xl sm:text-5xl font-black text-white font-mono m-0">
                {currency}{displayData.grandTotal.toFixed(2)}
              </p>
            </div>

            {/* Dynamic UPI QR Code */}
            <div className="my-4 p-4 rounded-3xl bg-white shadow-2xl flex flex-col items-center">
              <img
                src={qrCodeUrl}
                alt="Scan to Pay via UPI"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
              />
              <span className="text-[11px] font-bold text-slate-800 mt-2">
                Scan with GPay, PhonePe, Paytm, or any UPI App
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Instant & Secure Direct Payment</span>
              </div>
              <p className="text-[11px] text-slate-500 m-0">
                Amount is pre-filled automatically on your phone
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{shopName} • Powered by MS Store POS</span>
        <span>Secure Merchant Terminal</span>
      </footer>
    </div>
  );
}
