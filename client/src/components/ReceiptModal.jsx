import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Printer,
  CheckCircle2,
  X,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  Share2,
  Send,
  Copy,
  Check,
  Star,
  Award,
  MessageSquare,
  Phone
} from 'lucide-react';

export default function ReceiptModal({ receipt, settings, onClose }) {
  useEffect(() => {
    if (receipt) {
      // Fire celebratory confetti on bill completion
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#38bdf8', '#f59e0b'],
      });
    }
  }, [receipt]);

  const currency = settings?.currency_symbol || '₹';
  const invoiceNum = receipt?.invoiceNo || receipt?.invoice_no || 'BILL';
  const shopName = settings?.shop_name || 'MS Store';
  const tagline = settings?.tagline || '';
  const address = settings?.address || '';
  const phone = settings?.phone || '';
  const customerName = receipt?.customer_name || 'Walk-in Customer';
  const customerPhone = receipt?.customer_phone || '';
  const paymentMethod = receipt?.payment_method || 'Cash';
  const items = receipt?.items || [];

  const subtotalNum = Number(receipt?.subtotal || 0);
  const discountNum = Number(receipt?.discount_amount || 0);
  const taxNum = Number(receipt?.tax_amount || 0);
  const totalNum = Number(receipt?.total_amount || 0);
  const profitNum = Number(receipt?.profit || 0);

  const loyaltyEarnedNum = Number(receipt?.loyalty_points_earned || 0);
  const loyaltyRedeemedNum = Number(receipt?.loyalty_points_redeemed || 0);
  const loyaltyDiscountNum = Number(receipt?.loyalty_discount_amount || 0);
  const pointsBalNum = Number(receipt?.customer_points_balance || 0);

  const [eReceiptPhone, setEReceiptPhone] = useState(customerPhone || '');
  const [copiedEReceipt, setCopiedEReceipt] = useState(false);

  useEffect(() => {
    if (customerPhone) {
      setEReceiptPhone(customerPhone);
    }
  }, [customerPhone]);

  const dateObj = new Date(receipt?.created_at || Date.now());
  const dateStr = dateObj.toLocaleDateString();
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Constructed Paperless WhatsApp E-Receipt Text
  const whatsappEReceiptText = useMemo(() => {
    if (!receipt) return '';
    const itemsText = items
      .map((it, idx) => {
        const name = it.name || it.product_name || 'Item';
        const qty = it.quantity || 1;
        const sub = Number(it.subtotal || (Number(it.selling_price || 0) * qty)).toFixed(2);
        if (it.is_loose) {
          return `${idx + 1}. *${name}* × ${qty} kg @ ${currency}${Number(it.selling_price || 0).toFixed(2)}/kg = ${currency}${sub}`;
        }
        if (it.bag_weight) {
          const bagWt = parseFloat(it.bag_weight);
          const totalKg = (qty * bagWt).toFixed(qty % 1 !== 0 ? 1 : 0);
          return `${idx + 1}. *${name}* × ${qty} Bag${qty > 1 ? 's' : ''} (${totalKg} kg total) = ${currency}${sub}`;
        }
        return `${idx + 1}. *${name}* × ${qty} = ${currency}${sub}`;
      })
      .join('\n');

    let text =
      `🧾 *${shopName} — Digital E-Receipt*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 *Invoice:* ${invoiceNum}\n` +
      `📅 *Date:* ${dateStr}, ${timeStr}\n` +
      `👤 *Customer:* ${customerName}\n` +
      `🏪 *Counter:* ${receipt?.counter_name || 'Counter 1'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 *Items Purchased:*\n${itemsText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Subtotal: ${currency}${subtotalNum.toFixed(2)}\n`;

    if (discountNum > 0) {
      text += `Discount: -${currency}${discountNum.toFixed(2)}\n`;
    }
    if (loyaltyDiscountNum > 0) {
      text += `⭐ Loyalty Redeemed (${loyaltyRedeemedNum} pts): -${currency}${loyaltyDiscountNum.toFixed(2)}\n`;
    }
    if (taxNum > 0) {
      text += `GST / Tax: +${currency}${taxNum.toFixed(2)}\n`;
    }

    text +=
      `💰 *Grand Total Paid:* ${currency}${totalNum.toFixed(2)} (${paymentMethod})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (loyaltyEarnedNum > 0) {
      text += `⭐ *Loyalty Points Earned:* +${loyaltyEarnedNum} pts\n`;
    }
    if (pointsBalNum > 0) {
      text += `🌟 *Your Total Loyalty Balance:* ${pointsBalNum} pts (Worth ${currency}${pointsBalNum})\n`;
    }

    text +=
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ Thank you for shopping with us!\n` +
      (address ? `📍 ${address}\n` : '') +
      (phone ? `📞 Tel: ${phone}\n` : '') +
      `🌱 *MS Store Paperless E-Receipt*`;

    return text;
  }, [
    receipt,
    shopName,
    invoiceNum,
    dateStr,
    timeStr,
    customerName,
    items,
    currency,
    subtotalNum,
    discountNum,
    loyaltyDiscountNum,
    loyaltyRedeemedNum,
    taxNum,
    totalNum,
    paymentMethod,
    loyaltyEarnedNum,
    pointsBalNum,
    address,
    phone,
  ]);

  if (!receipt) return null;

  const handleSendWhatsAppEReceipt = () => {
    const cleanNumber = (eReceiptPhone || customerPhone || '').replace(/[^\d]/g, '');
    const encoded = encodeURIComponent(whatsappEReceiptText);
    const url = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyEReceipt = async () => {
    try {
      await navigator.clipboard.writeText(whatsappEReceiptText);
      setCopiedEReceipt(true);
      setTimeout(() => setCopiedEReceipt(false), 2500);
    } catch {
      alert('Failed to copy digital receipt.');
    }
  };

  // Generate self-contained, pure high-contrast black-and-white receipt HTML
  const generateReceiptHtml = () => {
    const itemsRowsHtml = items
      .map((item) => {
        const name = item.name || item.product_name || item.product?.name || 'Item';
        const qty = item.quantity || 1;
        const price = Number(item.selling_price || 0).toFixed(2);
        const gst = item.gst_percentage !== undefined ? `${item.gst_percentage}%` : '0%';
        const itemSubtotal = Number(item.subtotal || (item.selling_price * qty) || 0).toFixed(2);
        
        let qtyDisplay = `${qty}`;
        let subNote = '';
        if (item.is_loose) {
          qtyDisplay = `${qty} kg`;
        } else if (item.bag_weight) {
          const bagWt = parseFloat(item.bag_weight);
          const totalKg = (qty * bagWt).toFixed(qty % 1 !== 0 ? 1 : 0);
          qtyDisplay = `${qty} Bag${qty > 1 ? 's' : ''}`;
          subNote = `<div style="font-size:9.5px;color:#555555;font-weight:normal;">(${totalKg} kg total)</div>`;
        }

        return `
          <tr>
            <td class="name-cell">
              <div>${name}</div>
              ${subNote}
            </td>
            <td class="center-cell">${qtyDisplay}</td>
            <td class="right-cell">${currency}${price}</td>
            <td class="center-cell">${gst}</td>
            <td class="right-cell bold">${currency}${itemSubtotal}</td>
          </tr>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt - ${invoiceNum}</title>
    <style>
      @page {
        size: auto;
        margin: 4mm 6mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #000000 !important;
        background: #ffffff !important;
        font-size: 12px;
        line-height: 1.4;
        padding: 12px;
        width: 100%;
        max-width: 360px;
        margin: 0 auto;
      }
      .header {
        text-align: center;
        padding-bottom: 10px;
        border-bottom: 1px dashed #000000;
      }
      .shop-name {
        font-size: 18px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: -0.5px;
        color: #000000;
      }
      .shop-sub {
        font-size: 11px;
        color: #222222;
        margin-top: 2px;
      }
      .meta {
        padding: 8px 0;
        border-bottom: 1px dashed #000000;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #000000;
      }
      .meta-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: left;
      }
      .meta-right {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: right;
        align-items: flex-end;
      }
      .meta-label {
        color: #444444;
      }
      .bold {
        font-weight: 700;
        color: #000000;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .badge {
        display: inline-block;
        background: #f1f5f9;
        color: #000000;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        margin-top: 2px;
        border: 1px solid #cbd5e1;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 11px;
      }
      th {
        border-bottom: 1px solid #000000;
        padding: 4px 2px;
        color: #000000;
        font-weight: 700;
      }
      td {
        padding: 5px 2px;
        border-bottom: 1px solid #e2e8f0;
        color: #000000;
      }
      .name-cell {
        text-align: left;
        font-weight: 600;
        color: #000000;
        max-width: 130px;
        word-break: break-word;
      }
      .center-cell {
        text-align: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #000000;
      }
      .right-cell {
        text-align: right;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #000000;
      }
      .totals {
        padding: 6px 0;
        border-bottom: 1px dashed #000000;
        font-size: 11.5px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        color: #222222;
      }
      .discount-row {
        color: #047857;
        font-weight: 600;
      }
      .grand-total-row {
        border-top: 1px solid #000000;
        margin-top: 6px;
        padding-top: 6px;
        font-size: 15px;
        font-weight: 800;
        color: #000000;
      }
      .grand-total-val {
        color: #000000;
        font-weight: 900;
      }
      .footer {
        text-align: center;
        padding-top: 10px;
        font-size: 11px;
        color: #444444;
      }
      .print-btn-bar {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
      }
      .print-btn {
        flex: 1;
        padding: 8px 12px;
        background: #4f46e5;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 12px;
      }
      @media print {
        .print-btn-bar {
          display: none !important;
        }
        body {
          padding: 0;
          margin: 0;
          max-width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-btn-bar">
      <button class="print-btn" onclick="window.print()">Print Receipt</button>
      <button class="print-btn" style="background:#64748b;" onclick="window.close()">Close Window</button>
    </div>
    <div class="header">
      <div class="shop-name">${shopName}</div>
      ${tagline ? `<div class="shop-sub">${tagline}</div>` : ''}
      ${address ? `<div class="shop-sub">${address}</div>` : ''}
      ${phone ? `<div class="shop-sub">Tel: ${phone}</div>` : ''}
    </div>

    <div class="meta">
      <div class="meta-left">
        <div><span class="meta-label">Invoice:</span> <span class="mono bold">${invoiceNum}</span></div>
        <div><span class="meta-label">Customer:</span> <span class="bold">${customerName}</span></div>
        ${customerPhone ? `<div><span class="meta-label">Phone:</span> ${customerPhone}</div>` : ''}
      </div>
      <div class="meta-right">
        <div>${dateStr}</div>
        <div class="mono" style="font-size:10px;">${timeStr}</div>
        <div class="badge">${paymentMethod}</div>
        <div class="badge" style="background:#e0e7ff;color:#3730a3;border-color:#c7d2fe;">${receipt.counter_name || 'Counter 1'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Price</th>
          <th style="text-align: center;">GST</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span class="mono">${currency}${subtotalNum.toFixed(2)}</span>
      </div>
      ${discountNum > 0 ? `
        <div class="total-row discount-row">
          <span>Discount</span>
          <span class="mono">-${currency}${discountNum.toFixed(2)}</span>
        </div>
      ` : ''}
      ${loyaltyDiscountNum > 0 ? `
        <div class="total-row discount-row">
          <span>⭐ Loyalty Points Redeemed</span>
          <span class="mono">-${currency}${loyaltyDiscountNum.toFixed(2)}</span>
        </div>
      ` : ''}
      ${taxNum > 0 ? `
        <div class="total-row">
          <span>GST / Tax Total</span>
          <span class="mono bold">+${currency}${taxNum.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="total-row grand-total-row">
        <span>Grand Total</span>
        <span class="mono grand-total-val">${currency}${totalNum.toFixed(2)}</span>
      </div>
    </div>

    <div class="footer">
      ${(loyaltyEarnedNum > 0 || pointsBalNum > 0) ? `
        <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1; font-size: 11px;">
          ${loyaltyEarnedNum > 0 ? `<div>⭐ Points Earned on this Bill: <strong>+${loyaltyEarnedNum} pts</strong></div>` : ''}
          ${pointsBalNum > 0 ? `<div>🌟 Total Loyalty Points Balance: <strong>${pointsBalNum} pts</strong></div>` : ''}
        </div>
      ` : ''}
      <p style="font-weight: 600; color: #000000;">Thank you for shopping with us!</p>
      <p style="font-size: 10px; margin-top: 2px;">Please visit again</p>
    </div>
  </body>
</html>`;
  };

  // Open the printable bill in a fresh tab (fallback / alternative)
  const handleOpenNewWindow = () => {
    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      return;
    }
    const html = generateReceiptHtml();
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {}
    }, 400);
  };

  // Dedicated, isolated thermal & standard printer method (guarantees zero blank pages)
  const handlePrint = () => {
    try {
      const existingFrame = document.getElementById('receipt-print-iframe');
      if (existingFrame) {
        existingFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '420px';
      iframe.style.height = '700px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const html = generateReceiptHtml();
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        handleOpenNewWindow();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print error, falling back to new window:', err);
          handleOpenNewWindow();
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 350);
    } catch (err) {
      console.warn('Print error, falling back to new window:', err);
      handleOpenNewWindow();
    }
  };

  return (
    <div className="receipt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:backdrop-blur-none">
      {/* Container */}
      <div className="receipt-modal-container relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:static print:w-full print:max-w-none print:border-none print:shadow-none print:bg-transparent print:overflow-visible print:max-h-none">
        {/* Header bar (no-print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Bill Generated Successfully!</span>
            {(receipt.is_offline || String(invoiceNum).startsWith('INV-OFF')) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                OFFLINE SAVED
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Card */}
        <div className="receipt-modal-body overflow-y-auto p-6 text-slate-200 print:overflow-visible print:p-0 print:m-0">
          <div
            id="printable-receipt"
            className="bg-white text-slate-900 p-6 rounded-2xl shadow-md border border-slate-200 text-sm font-sans print:shadow-none print:border-none print:p-2 print:m-0 print:w-full"
          >
            {/* Shop Header */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 mb-2 no-print">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950 uppercase">
                {shopName}
              </h2>
              {tagline && <p className="text-xs text-slate-500 font-medium">{tagline}</p>}
              {address && (
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600 mt-1">
                  <span>{address}</span>
                </div>
              )}
              {phone && (
                <div className="text-[11px] text-slate-600">
                  <span>Tel: {phone}</span>
                </div>
              )}
              {(receipt.is_offline || String(invoiceNum).startsWith('INV-OFF')) && (
                <div className="mt-2 py-1 px-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold text-center">
                  ⚡ Offline Mode Invoice • Queued for Cloud Sync
                </div>
              )}
            </div>

            {/* Invoice Meta */}
            <div className="py-3 border-b border-dashed border-slate-300 text-xs flex justify-between items-start">
              <div>
                <p>
                  <span className="text-slate-500">Invoice:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{invoiceNum}</span>
                </p>
                <p>
                  <span className="text-slate-500">Customer:</span>{' '}
                  <span className="font-semibold text-slate-900">{customerName}</span>
                </p>
                {customerPhone && (
                  <p>
                    <span className="text-slate-500">Phone:</span> {customerPhone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-500">{dateStr}</p>
                <p className="text-slate-500 font-mono text-[11px]">{timeStr}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {paymentMethod}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {receipt.counter_name || 'Counter 1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b border-dashed border-slate-300">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left pb-1 font-semibold">Item</th>
                    <th className="text-center pb-1 font-semibold">Qty</th>
                    <th className="text-right pb-1 font-semibold">Price</th>
                    <th className="text-center pb-1 font-semibold">GST</th>
                    <th className="text-right pb-1 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const name = item.name || item.product_name || item.product?.name || 'Item';
                    const qty = item.quantity || 1;
                    const price = Number(item.selling_price || 0).toFixed(2);
                    const subtotal = Number(item.subtotal || (item.selling_price * qty) || 0).toFixed(2);
                    const gst = item.gst_percentage !== undefined ? `${item.gst_percentage}%` : '0%';
                    const isLoose = Boolean(item.is_loose);
                    const isBag = Boolean(item.bag_weight) && !isLoose;
                    const totalKg = isBag ? (qty * parseFloat(item.bag_weight)).toFixed(qty % 1 !== 0 ? 1 : 0) : null;

                    return (
                      <tr key={idx} className="py-1">
                        <td className="py-1.5 pr-2 font-medium text-slate-900">
                          <div>{name}</div>
                          {isBag && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-200">
                              🎒 {item.bag_weight} kg Bag ({totalKg} kg total)
                            </span>
                          )}
                          {isLoose && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                              ⚖️ Loose ({qty} kg)
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-center text-slate-600 font-mono">
                          {isBag ? `${qty} Bag${qty > 1 ? 's' : ''}` : isLoose ? `${qty} kg` : qty}
                        </td>
                        <td className="py-1.5 text-right text-slate-600 font-mono">
                          {currency}{price}
                        </td>
                        <td className="py-1.5 text-center font-mono text-[11px] text-slate-600">
                          {gst}
                        </td>
                        <td className="py-1.5 text-right font-bold text-slate-900 font-mono">
                          {currency}{subtotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{currency}{subtotalNum.toFixed(2)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">-{currency}{discountNum.toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscountNum > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>⭐ Loyalty Discount ({loyaltyRedeemedNum} pts)</span>
                  <span className="font-mono">-{currency}{loyaltyDiscountNum.toFixed(2)}</span>
                </div>
              )}
              {taxNum > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax Total</span>
                  <span className="font-mono font-semibold text-slate-900">+{currency}{taxNum.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-950 pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="font-mono text-indigo-600">{currency}{totalNum.toFixed(2)}</span>
              </div>
            </div>

            {/* Loyalty points balance note on receipt */}
            {(loyaltyEarnedNum > 0 || pointsBalNum > 0) && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-slate-300 text-xs text-slate-800 space-y-1">
                {loyaltyEarnedNum > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>⭐ Points Earned on this Bill:</span>
                    <span className="font-mono">+{loyaltyEarnedNum} pts</span>
                  </div>
                )}
                {pointsBalNum > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>🌟 Total Loyalty Points Balance:</span>
                    <span className="font-mono">{pointsBalNum} pts (Worth {currency}{pointsBalNum})</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer message */}
            <div className="text-center pt-4 text-[11px] text-slate-500">
              <p className="font-medium text-slate-700">Thank you for shopping with us!</p>
              <p className="text-[10px]">Please visit again</p>
            </div>
          </div>

          {/* Paperless WhatsApp E-Receipt Bar */}
          <div className="no-print mt-4 p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Paperless WhatsApp E-Receipt</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ECO-FRIENDLY
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Customer WhatsApp Phone..."
                  value={eReceiptPhone}
                  onChange={(e) => setEReceiptPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSendWhatsAppEReceipt}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send E-Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEReceipt}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Copy formatted E-Receipt text to clipboard"
                >
                  {copiedEReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedEReceipt ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Shop Owner Private Profit Indicator (No print) */}
          <div className="no-print mt-3 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Net Profit from this Bill:
            </span>
            <span className="font-bold text-emerald-300 font-mono text-sm">
              +{currency}{profitNum.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Buttons (no-print) */}
        <div className="no-print p-4 bg-slate-800/80 border-t border-slate-700/80 flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={handleOpenNewWindow}
            title="Open printable bill in a new tab"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 text-xs font-semibold rounded-xl transition active:scale-95 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>New Tab</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition active:scale-95 cursor-pointer"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
