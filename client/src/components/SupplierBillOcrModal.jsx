import React, { useState, useRef } from 'react';
import { X, Upload, ScanLine, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles, RefreshCw, Check, Package, DollarSign } from 'lucide-react';
import Tesseract from 'tesseract.js';
import confetti from 'canvas-confetti';
import ProductIcon from './ProductIcon';

export default function SupplierBillOcrModal({ isOpen, onClose, products = [], onBatchRestock, currencySymbol = '₹' }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle'); // 'idle' | 'processing' | 'done' | 'error'
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [rawText, setRawText] = useState('');
  const [extractedItems, setExtractedItems] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    loadImage(selected);
  };

  const loadImage = (imageFile) => {
    setFile(imageFile);
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    setOcrStatus('idle');
    setRawText('');
    setExtractedItems([]);
    setSelectedIndices(new Set());
    setErrorMessage('');
  };

  const parseOcrText = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
    const parsedList = [];

    // Common invoice noise words to ignore
    const ignoreKeywords = ['invoice', 'bill', 'tax', 'gstin', 'total', 'subtotal', 'date', 'phone', 'address', 'signature', 'cash', 'amount', 'terms', 'bank', 'ifsc', 'hsn', 'sac'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Skip lines that look like headers or footers
      if (ignoreKeywords.some((kw) => lower.includes(kw) && !lower.includes('milk') && !lower.includes('rice') && !lower.includes('oil'))) {
        continue;
      }

      // Regex to detect quantity and price in various formats:
      // Examples: "Amul Milk 500ml 20 28.00 560" or "Sugar 1kg x 10 @ 42.50" or "Soap Bar 15 pcs 35"
      const numberMatches = line.match(/(\d+(?:\.\d+)?)/g);
      if (!numberMatches || numberMatches.length === 0) continue;

      // Guess product text by stripping numbers from end
      const cleanName = line.replace(/[0-9.,@xX₹$#:]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanName.length < 2) continue;

      // Extract quantity (usually first integer or decimal between 1 and 9999)
      let detectedQty = 1;
      let detectedPrice = 0;

      if (numberMatches.length >= 2) {
        // Last or second-last number is usually price/total, earlier is quantity
        const num1 = parseFloat(numberMatches[0]);
        const num2 = parseFloat(numberMatches[1]);

        if (num1 <= 500 && num1 > 0) {
          detectedQty = num1;
          detectedPrice = num2;
        } else {
          detectedQty = 1;
          detectedPrice = num1;
        }
      } else if (numberMatches.length === 1) {
        detectedQty = parseFloat(numberMatches[0]) || 1;
      }

      // Try to match with existing inventory products
      let matchedProduct = null;
      const lowerName = cleanName.toLowerCase();

      for (const p of products) {
        const pLower = p.name.toLowerCase();
        const skuLower = p.sku.toLowerCase();

        if (lowerName.includes(pLower) || pLower.includes(lowerName) || lowerName.includes(skuLower)) {
          matchedProduct = p;
          break;
        }
      }

      // If matched, default to product's current cost if price was not clearly detected
      if (matchedProduct && detectedPrice <= 0) {
        detectedPrice = parseFloat(matchedProduct.cost_price) || 0;
      }

      parsedList.push({
        id: `ocr-${Date.now()}-${i}`,
        rawLine: line,
        detectedName: cleanName,
        quantity: detectedQty > 0 ? detectedQty : 10,
        costPrice: detectedPrice > 0 ? detectedPrice : (matchedProduct?.cost_price || 50),
        matchedProductId: matchedProduct ? matchedProduct.id : (products[0]?.id || null),
      });
    }

    // Default select all parsed items
    setExtractedItems(parsedList);
    setSelectedIndices(new Set(parsedList.map((_, idx) => idx)));
  };

  const handleStartOcr = async () => {
    if (!file) return;

    try {
      setOcrStatus('processing');
      setProgress(5);
      setStatusMessage('Initializing OCR Vision Engine...');

      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.floor((m.progress || 0) * 100);
            setProgress(p);
            setStatusMessage(`Scanning invoice text... ${p}%`);
          } else if (m.status) {
            setStatusMessage(`Preparing: ${m.status}...`);
          }
        },
      });

      const text = result.data.text || '';
      setRawText(text);
      setStatusMessage('Parsing detected items, quantities & prices...');
      parseOcrText(text);
      setOcrStatus('done');
    } catch (err) {
      console.error('OCR error:', err);
      setOcrStatus('error');
      setErrorMessage(err.message || 'Failed to scan image. Please try a clearer bill photo.');
    }
  };

  // Sample demo bills for instant test
  const loadDemoBill = (type = 'grocery') => {
    let demoText = '';
    if (type === 'grocery') {
      demoText = `
TAX INVOICE - OM WHOLESALE TRADERS
GSTIN: 27AABCT3518Q1ZV
Date: 01/10/2026  Inv: WH-8492
------------------------------------------------
Item Name             Qty    Rate     Total
Parle-G Biscuit 100g  40     9.20     368.00
Tata Tea Gold 250g    15     125.00   1875.00
Amul Butter 100g      25     48.50    1212.50
Basmati Rice 5kg      10     310.00   3100.00
Sunflower Oil 1L      20     135.00   2700.00
------------------------------------------------
Sub Total: Rs. 9,255.50
CGST 2.5%: Rs. 231.38
SGST 2.5%: Rs. 231.38
Grand Total: Rs. 9,718.26
      `.trim();
    } else {
      demoText = `
VENDOR PURCHASE MEMO - METRO TECH SUPPLIES
Invoice: TECH-2026-904
------------------------------------------------
Wireless Mouse USB    12     320.00   3840.00
Mechanical Keyboard   5      1250.00  6250.00
USB-C Fast Cable      30     65.00    1950.00
Bluetooth Speaker     8      540.00   4320.00
------------------------------------------------
Total Payable: Rs. 16,360.00
      `.trim();
    }

    setRawText(demoText);
    setOcrStatus('done');
    parseOcrText(demoText);
  };

  const toggleSelect = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === extractedItems.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(extractedItems.map((_, i) => i)));
    }
  };

  const handleUpdateItem = (index, field, value) => {
    setExtractedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirmRestock = async () => {
    const itemsToRestock = extractedItems.filter((_, idx) => selectedIndices.has(idx));
    if (itemsToRestock.length === 0) {
      alert('Please select at least 1 item to restock.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onBatchRestock(itemsToRestock);
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {}
      onClose();
    } catch (err) {
      alert('Error updating stock: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Supplier Bill Photo Scanner (OCR)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  AI Optical Extraction
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload vendor paper bills to auto-extract items, quantities, and restock instantly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top upload area & sample buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-2 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-800/40 hover:bg-indigo-950/10 transition group flex flex-col items-center justify-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 transition">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                {file ? file.name : 'Click to Upload or Drag & Drop Vendor Bill'}
              </p>
              <p className="text-xs text-slate-400">Supports JPG, PNG, WEBP invoices & paper slips</p>
            </div>

            {/* Quick Demo Pre-sets */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Instant Test Bill Demo
                </span>
                <p className="text-[11px] text-slate-400 mb-3">
                  Don't have a paper receipt right now? Load a realistic vendor bill sample:
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => loadDemoBill('grocery')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition text-left flex items-center justify-between"
                >
                  <span>🛒 Grocery Wholesale Bill</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoBill('electronics')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition text-left flex items-center justify-between"
                >
                  <span>🔌 Tech Supply Invoice</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* If file is chosen but OCR not yet triggered */}
          {file && ocrStatus === 'idle' && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Bill image ready: {file.name}</p>
                  <p className="text-xs text-indigo-300">{(file.size / 1024).toFixed(1)} KB image loaded</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartOcr}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition"
              >
                <ScanLine className="w-4 h-4" /> Start AI OCR Scan
              </button>
            </div>
          )}

          {/* OCR In Progress Status */}
          {ocrStatus === 'processing' && (
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-indigo-500/40 space-y-3 text-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-white">{statusMessage}</p>
              <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">Using client-side Tesseract.js neural vision</p>
            </div>
          )}

          {/* OCR Error Alert */}
          {ocrStatus === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Items Table */}
          {ocrStatus === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    Extracted Line Items ({extractedItems.length} found)
                  </span>
                  <span className="text-xs text-slate-400">
                    ({selectedIndices.size} selected for restock)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    {selectedIndices.size === extractedItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {extractedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-800/40 rounded-2xl border border-slate-700/80">
                  <p className="text-slate-400 text-sm">
                    No clear line items detected in this image. Try one of the sample demo bills or upload a higher resolution photo.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
                        <tr>
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIndices.size === extractedItems.length && extractedItems.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                            />
                          </th>
                          <th className="p-3">Detected Line Text</th>
                          <th className="p-3">Matched Inventory Product</th>
                          <th className="p-3 w-28">Quantity</th>
                          <th className="p-3 w-32">Purchase Cost ({currencySymbol})</th>
                          <th className="p-3 w-28 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {extractedItems.map((item, idx) => {
                          const isSelected = selectedIndices.has(idx);
                          const matched = products.find((p) => p.id === Number(item.matchedProductId));
                          const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.costPrice) || 0);

                          return (
                            <tr
                              key={item.id}
                              className={`transition ${
                                isSelected ? 'bg-indigo-950/20' : 'opacity-60 bg-slate-900/30'
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(idx)}
                                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                                />
                              </td>
                              <td className="p-3 font-mono text-slate-300">
                                <span className="font-semibold text-white block">{item.detectedName}</span>
                                <span className="text-[10px] text-slate-500 truncate block max-w-xs">
                                  {item.rawLine}
                                </span>
                              </td>
                              <td className="p-3">
                                <select
                                  value={item.matchedProductId || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'matchedProductId', Number(e.target.value))}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.sku}) - Current: {p.stock_quantity} {p.unit}
                                    </option>
                                  ))}
                                </select>
                                {matched && (
                                  <span className="text-[10px] text-emerald-400 mt-0.5 block">
                                    Current Stock: {matched.stock_quantity} {matched.unit}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.costPrice}
                                  onChange={(e) => handleUpdateItem(idx, 'costPrice', e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="p-3 text-right font-mono text-slate-200 font-bold">
                                {currencySymbol}{lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            Cancel
          </button>

          {ocrStatus === 'done' && extractedItems.length > 0 && (
            <button
              type="button"
              disabled={selectedIndices.size === 0 || isSubmitting}
              onClick={handleConfirmRestock}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Restocking...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Apply Restock to Inventory ({selectedIndices.size} Items)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
