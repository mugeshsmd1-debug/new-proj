import { offlineStorage } from './offlineStorage';

const SESSION_KEY = 'ms_store_active_user';
const CUSTOM_API_KEY = 'ms_store_backend_url';

export const DEFAULT_SUPABASE_BACKEND = 'https://thjfjhekmqwgtypbhlar.supabase.co/functions/v1/api';

export function normalizeApiUrl(raw) {
  if (!raw) return '';
  let url = raw.trim();
  url = url.replace(/\/+$/, '');
  return url;
}

export function getEffectiveApiBase() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return normalizeApiUrl(envUrl);
  }
  try {
    const custom = (localStorage.getItem(CUSTOM_API_KEY) || '').trim();
    if (custom) {
      return normalizeApiUrl(custom);
    }
  } catch {}
  return DEFAULT_SUPABASE_BACKEND;
}

export function setCustomApiUrl(url) {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(CUSTOM_API_KEY);
    } else {
      localStorage.setItem(CUSTOM_API_KEY, normalizeApiUrl(url));
    }
  } catch {}
}

export function getCustomApiUrl() {
  try {
    return localStorage.getItem(CUSTOM_API_KEY) || '';
  } catch {
    return '';
  }
}

function getSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionUser(user) {
  try {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to store session:', e);
  }
}

async function request(path, options = {}) {
  const currentUser = getSessionUser();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(currentUser?.email ? { 'x-user-email': currentUser.email } : {}),
  };

  const apiBase = getEffectiveApiBase();
  const url = `${apiBase}${path.startsWith('/') ? path : '/' + path}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(`Supabase backend returned invalid response format (${contentType}, Status: ${res.status}).`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error(`Cannot reach Supabase backend at ${apiBase}. Please check your internet connection.`);
    }
    throw err;
  }
}

export const api = {
  // Session Authentication
  getCurrentUser() {
    return getSessionUser();
  },

  async signup(userData) {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (data?.user) {
      setSessionUser(data.user);
    }
    return data.user;
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data?.user) {
      setSessionUser(data.user);
    }
    return data.user;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {}
    setSessionUser(null);
    return { success: true };
  },

  // Settings
  async getSettings() {
    try {
      const data = await request('/settings');
      if (data) {
        offlineStorage.setMeta('store_settings', data).catch(() => {});
      }
      return data;
    } catch (err) {
      const cached = await offlineStorage.getMeta('store_settings');
      if (cached) return cached;
      throw err;
    }
  },

  async updateSettings(settings) {
    const updated = await request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    if (updated) {
      offlineStorage.setMeta('store_settings', updated).catch(() => {});
    }
    return updated;
  },

  // Products with Offline-First IndexedDB caching & fallback
  async getProducts(params = {}) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cached = await offlineStorage.getProducts();
      return this._filterCachedProducts(cached, params);
    }

    try {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.category && params.category !== 'All') query.append('category', params.category);
      if (params.lowStockOnly) query.append('lowStockOnly', 'true');

      const qs = query.toString();
      const products = await request(`/products${qs ? '?' + qs : ''}`);

      // Cache full product catalog to IndexedDB when unfiltered
      if (!params.search && (!params.category || params.category === 'All') && !params.lowStockOnly) {
        if (Array.isArray(products)) {
          offlineStorage.saveProducts(products).catch(() => {});
        }
      }
      return products;
    } catch (err) {
      console.warn('Network request failed for products, serving from offline IndexedDB cache:', err.message);
      const cached = await offlineStorage.getProducts();
      if (cached && cached.length > 0) {
        return this._filterCachedProducts(cached, params);
      }
      throw err;
    }
  },

  _filterCachedProducts(products, params = {}) {
    let result = products || [];
    if (params.search) {
      const s = params.search.toLowerCase();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(s)) ||
        (p.sku && p.sku.toLowerCase().includes(s)) ||
        (p.category && p.category.toLowerCase().includes(s))
      );
    }
    if (params.category && params.category !== 'All') {
      result = result.filter(p => p.category === params.category);
    }
    if (params.lowStockOnly) {
      result = result.filter(p => (parseFloat(p.stock_quantity) || 0) <= (parseFloat(p.low_stock_threshold) || 5));
    }
    return result;
  },

  async getCategories() {
    try {
      return await request('/products/categories');
    } catch (err) {
      const cached = await offlineStorage.getProducts();
      const cats = Array.from(new Set(cached.map(p => p.category).filter(Boolean)));
      return cats.length > 0 ? cats : ['General'];
    }
  },

  async createProduct(productData) {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  async updateProduct(id, productData) {
    return request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  async adjustStock(id, data) {
    return request(`/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async openSealedBag(id, bags = 1) {
    return request(`/products/${id}/open-bag`, {
      method: 'POST',
      body: JSON.stringify({ bags }),
    });
  },

  async deleteProduct(id) {
    return request(`/products/${id}`, { method: 'DELETE' });
  },

  // Inventory Stock Audit Logs
  async getAuditLogs(limit = 100) {
    return request(`/inventory/logs?limit=${limit}`);
  },

  // Orders / Billing with Zero-Lag Offline Checkout & Background Queue
  async createOrder(orderData) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      return await offlineStorage.saveOfflineOrder(orderData);
    }

    try {
      return await request('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    } catch (err) {
      const isNetErr = err.message?.includes('Cannot reach') ||
                       err.message?.includes('Failed to fetch') ||
                       err.message?.includes('NetworkError') ||
                       err.name === 'TypeError';
      if (isNetErr) {
        console.warn('Network unreachable during order placement, saving offline:', err.message);
        return await offlineStorage.saveOfflineOrder(orderData);
      }
      throw err;
    }
  },

  // Offline Synchronization APIs
  async getPendingOfflineOrders() {
    return await offlineStorage.getPendingOfflineOrders();
  },

  async getPendingOfflineCount() {
    return await offlineStorage.getPendingCount();
  },

  async syncPendingOrders() {
    const pending = await offlineStorage.getPendingOfflineOrders();
    if (!pending || pending.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const order of pending) {
      try {
        const payload = {
          items: (order.items || []).map(it => ({
            id: it.product_id || it.id,
            product_id: it.product_id || it.id,
            quantity: it.quantity,
            selling_price: it.selling_price,
            cost_price: it.cost_price,
            gst_percentage: it.gst_percentage,
            bag_weight: it.bag_weight ? parseFloat(it.bag_weight) : null,
            is_loose: Boolean(it.is_loose),
            display_name: it.display_name || it.name,
          })),
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          discount_amount: order.discount_amount,
          loyalty_points_earned: order.loyalty_points_earned || 0,
          loyalty_points_redeemed: order.loyalty_points_redeemed || 0,
          loyalty_discount_amount: order.loyalty_discount_amount || 0,
          payment_method: order.payment_method,
          tax_percentage: order.tax_amount && order.subtotal ? ((order.tax_amount / order.subtotal) * 100) : 5,
          counter_name: order.counter_name || 'Counter 1 (Offline Sync)',
          offline_invoice_no: order.invoice_no,
        };

        await request('/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        await offlineStorage.removeOfflineOrder(order.id);
        synced++;
      } catch (err) {
        console.error(`Failed to sync offline order ${order.invoice_no}:`, err);
        failed++;
      }
    }

    // Refresh catalog in background
    try {
      const freshProds = await request('/products');
      if (Array.isArray(freshProds)) {
        await offlineStorage.saveProducts(freshProds);
      }
    } catch {}

    return { total: pending.length, synced, failed };
  },

  // Customers & Loyalty CRM
  async getCustomers(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.limit) q.append('limit', params.limit);
    const qs = q.toString();
    try {
      return await request(`/customers${qs ? '?' + qs : ''}`);
    } catch {
      return [];
    }
  },

  async lookupCustomer(phone) {
    if (!phone || !phone.trim()) return null;
    try {
      return await request(`/customers/lookup/${encodeURIComponent(phone.trim())}`);
    } catch {
      return null;
    }
  },

  async createOrUpdateCustomer(custData) {
    return request('/customers', {
      method: 'POST',
      body: JSON.stringify(custData),
    });
  },

  async adjustCustomerPoints(id, data) {
    return request(`/customers/${id}/points`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getOrders(params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);

    const qs = query.toString();
    return request(`/orders${qs ? '?' + qs : ''}`);
  },

  async getOrderById(id) {
    return request(`/orders/${id}`);
  },

  // Delete all bill history alone (keeps products & catalog intact, verified by password)
  async clearBillHistory(password) {
    return request('/orders/clear', {
      method: 'DELETE',
      headers: {
        'x-auth-password': password || '',
      },
      body: JSON.stringify({ password: password || '' }),
    });
  },

  // Delete single bill / order (verified by account password)
  async deleteOrder(id, password) {
    return request(`/orders/${id}`, {
      method: 'DELETE',
      headers: {
        'x-auth-password': password || '',
      },
      body: JSON.stringify({ password: password || '' }),
    });
  },

  // Process Sales Return / Refund & Credit Note
  async processReturn(orderId, returnPayload) {
    return request(`/orders/${orderId}/return`, {
      method: 'POST',
      body: JSON.stringify(returnPayload),
    });
  },

  // Analytics & PnL
  async getPnL(params = 'all') {
    let queryString = '';
    if (typeof params === 'string') {
      queryString = `range=${encodeURIComponent(params)}`;
    } else if (typeof params === 'object' && params !== null) {
      const q = new URLSearchParams();
      if (params.mode) q.append('mode', params.mode);
      if (params.range) q.append('range', params.range);
      if (params.date) q.append('date', params.date);
      if (params.month) q.append('month', params.month);
      if (params.year) q.append('year', params.year);
      queryString = q.toString();
    }

    return request(`/analytics/pnl${queryString ? '?' + queryString : ''}`);
  },

  // AI Reorder & Depletion Forecasting
  async getReorderForecast() {
    return request('/analytics/reorder-forecast');
  },

  // Public Online Storefront & WhatsApp Orders
  async getPublicStore(storeEmail) {
    return request(`/public/store?email=${encodeURIComponent(storeEmail)}`);
  },

  async createPublicOrder(orderData) {
    return request('/public/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  // Factory Reset (verified by account password)
  async clearAllData(password) {
    return request('/system/reset', {
      method: 'POST',
      headers: {
        'x-auth-password': password || '',
      },
      body: JSON.stringify({ password: password || '' }),
    });
  },

  // Backend Connectivity Diagnostics
  getEffectiveBase() {
    return getEffectiveApiBase();
  },
  setCustomBackendUrl(url) {
    setCustomApiUrl(url);
  },
  getCustomBackendUrl() {
    return getCustomApiUrl();
  },
  async testBackendConnection(testUrl) {
    const base = testUrl ? normalizeApiUrl(testUrl) : getEffectiveApiBase();
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      return { ok: true, data, url: base };
    } catch (e1) {
      try {
        const res2 = await fetch(base, { signal: AbortSignal.timeout(6000) });
        const data2 = await res2.json();
        return { ok: true, data: data2, url: base };
      } catch (e2) {
        return { ok: false, error: e2.message || e1.message, url: base };
      }
    }
  },
};
