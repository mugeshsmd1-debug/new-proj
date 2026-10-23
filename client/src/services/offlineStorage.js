// client/src/services/offlineStorage.js
// Client-side IndexedDB persistence for Full Offline-First POS Billing and Stock Management

const DB_NAME = 'ms_store_offline_db';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this browser.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Cached Products Store
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('sku', 'sku', { unique: false });
        prodStore.createIndex('category', 'category', { unique: false });
        prodStore.createIndex('name', 'name', { unique: false });
      }

      // 2. Pending Offline Orders Store
      if (!db.objectStoreNames.contains('offline_orders')) {
        const orderStore = db.createObjectStore('offline_orders', { keyPath: 'id' });
        orderStore.createIndex('created_at', 'created_at', { unique: false });
        orderStore.createIndex('invoice_no', 'invoice_no', { unique: false });
      }

      // 3. Metadata & Settings Store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Failed to open offline IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

export const offlineStorage = {
  // ----------------------------------------------------
  // PRODUCT CATALOG CACHING
  // ----------------------------------------------------
  async saveProducts(products = []) {
    try {
      const db = await openDB();
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');

      // Clear existing cached products and replace with fresh snapshot
      await new Promise((resolve, reject) => {
        const clearReq = store.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      });

      for (const prod of products) {
        store.put(prod);
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Save cache timestamp
      await this.setMeta('products_cached_at', new Date().toISOString());
      return true;
    } catch (err) {
      console.warn('Failed to cache products to IndexedDB:', err);
      return false;
    }
  },

  async getProducts() {
    try {
      const db = await openDB();
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('Failed to load products from IndexedDB:', err);
      return [];
    }
  },

  // Decrement product stock in local IndexedDB during offline checkout
  async deductLocalStock(items = []) {
    try {
      const db = await openDB();
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');

      for (const item of items) {
        const prodId = item.product_id || item.id;
        if (!prodId) continue;

        const getReq = store.get(prodId);
        getReq.onsuccess = () => {
          const prod = getReq.result;
          if (prod) {
            const qty = parseFloat(item.quantity) || 1;
            const deductQty = item.stock_deduct_quantity !== undefined
              ? parseFloat(item.stock_deduct_quantity)
              : item.bag_weight
              ? qty * parseFloat(item.bag_weight)
              : qty;
            const updatedStock = Math.max(0, (parseFloat(prod.stock_quantity) || 0) - deductQty);
            prod.stock_quantity = parseFloat(updatedStock.toFixed(3));
            store.put(prod);
          }
        };
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.warn('Failed to deduct local offline stock in IndexedDB:', err);
      return false;
    }
  },

  // ----------------------------------------------------
  // OFFLINE ORDERS QUEUE & SYNC
  // ----------------------------------------------------
  async saveOfflineOrder(orderPayload) {
    try {
      const db = await openDB();
      const tx = db.transaction('offline_orders', 'readwrite');
      const store = tx.objectStore('offline_orders');

      const now = new Date();
      const dateSuffix = now.toISOString().slice(2, 10).replace(/-/g, '');
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const offlineInvoiceNo = `INV-OFF-${dateSuffix}-${randSuffix}`;
      const offlineOrderId = `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Calculate totals
      const items = orderPayload.items || [];
      const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.subtotal) || (parseFloat(it.selling_price || 0) * parseFloat(it.quantity || 1))), 0);
      const manualDiscount = parseFloat(orderPayload.discount_amount) || 0;
      const loyaltyDiscount = parseFloat(orderPayload.loyalty_discount_amount) || 0;
      const totalDiscount = manualDiscount + loyaltyDiscount;
      const taxRate = parseFloat(orderPayload.tax_percentage) || 5.0;
      const taxable = Math.max(0, subtotal - totalDiscount);
      const taxAmount = (taxable * taxRate) / 100;
      const totalAmount = taxable + taxAmount;

      const offlineOrder = {
        id: offlineOrderId,
        invoice_no: offlineInvoiceNo,
        invoiceNo: offlineInvoiceNo,
        counter_name: orderPayload.counter_name || 'Counter 1 (Offline)',
        customer_name: orderPayload.customer_name || 'Walk-in Customer',
        customer_phone: orderPayload.customer_phone || '',
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount_amount: parseFloat(manualDiscount.toFixed(2)),
        loyalty_discount_amount: parseFloat(loyaltyDiscount.toFixed(2)),
        loyalty_points_earned: parseFloat(orderPayload.loyalty_points_earned) || 0,
        loyalty_points_redeemed: parseFloat(orderPayload.loyalty_points_redeemed) || 0,
        tax_amount: parseFloat(taxAmount.toFixed(2)),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        payment_method: orderPayload.payment_method || 'Cash',
        created_at: now.toISOString(),
        items: items.map((it) => ({
          product_id: it.product_id || it.id,
          id: it.product_id || it.id,
          name: it.name || it.product_name || it.display_name,
          display_name: it.display_name || it.name || it.product_name,
          product_name: it.name || it.product_name || it.display_name,
          sku: it.sku || 'SKU-GEN',
          quantity: parseFloat(it.quantity) || 1,
          selling_price: parseFloat(it.selling_price) || 0,
          cost_price: parseFloat(it.cost_price) || 0,
          subtotal: parseFloat(it.subtotal || ((it.selling_price || 0) * (it.quantity || 1))),
          gst_percentage: parseFloat(it.gst_percentage) || taxRate,
          bag_weight: it.bag_weight ? parseFloat(it.bag_weight) : null,
          is_loose: Boolean(it.is_loose),
          stock_deduct_quantity: it.bag_weight ? (parseFloat(it.quantity) * parseFloat(it.bag_weight)) : (parseFloat(it.quantity) || 1),
        })),
        is_offline: true,
        offline_timestamp: Date.now(),
      };

      store.put(offlineOrder);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Also deduct from local cached stock immediately
      await this.deductLocalStock(items);

      // Notify window of offline order
      try {
        window.dispatchEvent(new CustomEvent('ms_store_offline_order_saved', { detail: offlineOrder }));
      } catch {}

      return offlineOrder;
    } catch (err) {
      console.error('Failed to save offline order to IndexedDB:', err);
      throw new Error(`Offline storage error: ${err.message}`);
    }
  },

  async getPendingOfflineOrders() {
    try {
      const db = await openDB();
      const tx = db.transaction('offline_orders', 'readonly');
      const store = tx.objectStore('offline_orders');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('Failed to get pending offline orders:', err);
      return [];
    }
  },

  async removeOfflineOrder(orderId) {
    try {
      const db = await openDB();
      const tx = db.transaction('offline_orders', 'readwrite');
      const store = tx.objectStore('offline_orders');

      store.delete(orderId);

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.warn('Failed to remove synced offline order:', err);
      return false;
    }
  },

  async getPendingCount() {
    try {
      const orders = await this.getPendingOfflineOrders();
      return orders.length;
    } catch {
      return 0;
    }
  },

  // ----------------------------------------------------
  // METADATA & SETTINGS CACHING
  // ----------------------------------------------------
  async setMeta(key, value) {
    try {
      const db = await openDB();
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      store.put({ key, value });
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  },

  async getMeta(key) {
    try {
      const db = await openDB();
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }
};
