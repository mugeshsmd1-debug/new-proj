// Client-side persistent storage engine with Account-Scoped Data Isolation
const STORAGE_KEYS = {
  USERS: 'ms_store_users',
  ACTIVE_USER: 'ms_store_active_user',
  SETTINGS: 'ms_store_settings',
  PRODUCTS: 'ms_store_products',
  ORDERS: 'ms_store_orders',
  STOCK_LOGS: 'ms_store_stock_logs',
  AUTH: 'ms_store_auth',
};

const DEFAULT_SETTINGS = {
  id: 1,
  shop_name: 'MS Store',
  tagline: 'Smart Retail & Inventory Management',
  phone: '',
  address: '',
  currency_symbol: '₹',
  tax_percentage: 5.0,
  owner_name: '',
  owner_email: '',
  owner_pin: '',
};

// Clean slate: No dummy products or orders!
const DEFAULT_PRODUCTS = [];
const DEFAULT_ORDERS = [];

function getActiveUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getUserScopedKey(key) {
  // Global user registry and session are not scoped
  if (key === STORAGE_KEYS.USERS || key === STORAGE_KEYS.ACTIVE_USER) {
    return key;
  }
  const user = getActiveUser();
  if (user && user.email) {
    const safeEmail = user.email.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `${key}_${safeEmail}`;
  }
  return key;
}

function getStored(key, defaultVal) {
  try {
    const scopedKey = getUserScopedKey(key);
    let raw = localStorage.getItem(scopedKey);

    // If scoped key doesn't exist yet, check if base key has legacy data to migrate
    if (!raw && scopedKey !== key) {
      const legacyRaw = localStorage.getItem(key);
      if (legacyRaw) {
        localStorage.setItem(scopedKey, legacyRaw);
        raw = legacyRaw;
      }
    }

    if (!raw) {
      localStorage.setItem(scopedKey, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setStored(key, value) {
  try {
    const scopedKey = getUserScopedKey(key);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export const localStore = {
  // User Authentication & Account Registry
  getCurrentUser() {
    return getActiveUser();
  },

  getUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  signup(userData) {
    const users = this.getUsers();
    const email = (userData.email || '').trim().toLowerCase();
    const password = (userData.password || '').trim();
    const name = (userData.name || '').trim();
    const shop_name = (userData.shop_name || 'MS Store').trim();
    const phone = (userData.phone || '').trim();

    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address (e.g. yourname@gmail.com).');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    if (!name) {
      throw new Error('Please enter your full name.');
    }

    const existing = users.find((u) => u.email === email);
    if (existing) {
      throw new Error(`An account with email "${email}" already exists. Please Log In.`);
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      email,
      password,
      name,
      shop_name,
      phone,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const userSession = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      shop_name: newUser.shop_name,
      phone: newUser.phone,
      token: 'session_' + Date.now(),
      logged_in_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(userSession));

    // Initialize user settings
    const initialSettings = {
      ...DEFAULT_SETTINGS,
      shop_name,
      owner_name: name,
      owner_email: email,
      phone,
    };
    this.updateSettings(initialSettings);

    return userSession;
  },

  login(email, password) {
    const users = this.getUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your password.');
    }

    const user = users.find(
      (u) => u.email === cleanEmail && u.password === cleanPassword
    );

    if (!user) {
      if (users.length === 0) {
        throw new Error('No registered account found. Please click Sign Up to register.');
      }
      throw new Error('Invalid email or password. Please verify and try again.');
    }

    const userSession = {
      id: user.id,
      email: user.email,
      name: user.name,
      shop_name: user.shop_name,
      phone: user.phone,
      token: 'session_' + Date.now(),
      logged_in_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(userSession));

    return userSession;
  },

  logout() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    } catch {}
    return { success: true };
  },

  // Legacy auth helper compatibility
  getAuth() {
    return this.getCurrentUser();
  },

  saveAuth(authData) {
    if (authData.email && authData.password) {
      try {
        return this.signup(authData);
      } catch {
        return this.login(authData.email, authData.password);
      }
    }
    return authData;
  },

  clearAuth() {
    return this.logout();
  },

  // Settings (Account-scoped)
  getSettings() {
    return getStored(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings, updated_at: new Date().toISOString() };
    setStored(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  // Wipe / Reset current account data to start completely fresh
  clearAllData(password) {
    const user = getActiveUser();
    if (user && user.password && password && user.password !== password.trim()) {
      throw new Error('Incorrect account password. Store was not reset.');
    }
    try {
      const pKey = getUserScopedKey(STORAGE_KEYS.PRODUCTS);
      const oKey = getUserScopedKey(STORAGE_KEYS.ORDERS);
      const sKey = getUserScopedKey(STORAGE_KEYS.STOCK_LOGS);
      localStorage.removeItem(pKey);
      localStorage.removeItem(oKey);
      localStorage.removeItem(sKey);
      localStorage.setItem(pKey, JSON.stringify([]));
      localStorage.setItem(oKey, JSON.stringify([]));
      localStorage.setItem(sKey, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
    return { success: true };
  },


  // Products
  getProducts({ search = '', category = 'All', lowStockOnly = false } = {}) {
    let prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);

    if (search) {
      const q = search.toLowerCase();
      prods = prods.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    if (category && category !== 'All') {
      prods = prods.filter((p) => p.category === category);
    }

    if (lowStockOnly) {
      prods = prods.filter((p) => p.stock_quantity <= p.low_stock_threshold);
    }

    return prods.sort((a, b) => a.name.localeCompare(b.name));
  },

  getCategories() {
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const set = new Set(prods.map((p) => p.category));
    return Array.from(set).sort();
  },

  createProduct(productData) {
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const cleanSku = String(productData.sku).trim().toUpperCase();

    if (prods.some((p) => p.sku.toUpperCase() === cleanSku)) {
      throw new Error(`Product SKU "${cleanSku}" already exists.`);
    }

    const newId = prods.length > 0 ? Math.max(...prods.map((p) => p.id || 0)) + 1 : 1;
    const newProduct = {
      id: newId,
      name: productData.name.trim(),
      sku: cleanSku,
      category: productData.category?.trim() || 'General',
      cost_price: parseFloat(productData.cost_price) || 0,
      selling_price: parseFloat(productData.selling_price) || 0,
      stock_quantity: parseInt(productData.stock_quantity, 10) || 0,
      low_stock_threshold: parseInt(productData.low_stock_threshold, 10) || 5,
      unit: productData.unit || 'pcs',
      image_emoji: productData.image_emoji || '📦',
      gst_percentage: productData.gst_percentage !== undefined ? parseFloat(productData.gst_percentage) : 5.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    prods.push(newProduct);
    setStored(STORAGE_KEYS.PRODUCTS, prods);
    return newProduct;
  },

  updateProduct(id, productData) {
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const index = prods.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new Error('Product not found.');

    const cleanSku = productData.sku ? String(productData.sku).trim().toUpperCase() : prods[index].sku;
    if (cleanSku !== prods[index].sku && prods.some((p) => p.sku.toUpperCase() === cleanSku && p.id !== Number(id))) {
      throw new Error(`SKU "${cleanSku}" is already taken.`);
    }

    const updated = {
      ...prods[index],
      ...productData,
      sku: cleanSku,
      cost_price: productData.cost_price !== undefined ? parseFloat(productData.cost_price) : prods[index].cost_price,
      selling_price: productData.selling_price !== undefined ? parseFloat(productData.selling_price) : prods[index].selling_price,
      stock_quantity: productData.stock_quantity !== undefined ? parseInt(productData.stock_quantity, 10) : prods[index].stock_quantity,
      low_stock_threshold: productData.low_stock_threshold !== undefined ? parseInt(productData.low_stock_threshold, 10) : prods[index].low_stock_threshold,
      gst_percentage: productData.gst_percentage !== undefined ? parseFloat(productData.gst_percentage) : prods[index].gst_percentage,
      updated_at: new Date().toISOString(),
    };

    prods[index] = updated;
    setStored(STORAGE_KEYS.PRODUCTS, prods);
    return updated;
  },

  adjustStock(id, { delta, newStock, note, type }) {
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const index = prods.findIndex((p) => p.id === Number(id));
    if (index === -1) throw new Error('Product not found.');

    const prod = prods[index];
    let updatedQty;
    if (delta !== undefined) {
      updatedQty = prod.stock_quantity + parseInt(delta, 10);
    } else if (newStock !== undefined) {
      updatedQty = parseInt(newStock, 10);
    } else {
      throw new Error('Provide delta or newStock.');
    }

    if (updatedQty < 0) throw new Error('Stock quantity cannot be negative.');

    prod.stock_quantity = updatedQty;
    prod.updated_at = new Date().toISOString();
    setStored(STORAGE_KEYS.PRODUCTS, prods);
    return prod;
  },

  deleteProduct(id) {
    let prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const target = prods.find((p) => p.id === Number(id));
    if (!target) throw new Error('Product not found.');

    prods = prods.filter((p) => p.id !== Number(id));
    setStored(STORAGE_KEYS.PRODUCTS, prods);
    return { message: 'Product deleted', product: target };
  },

  // Orders
  createOrder({ items, customer_name, customer_phone, discount_amount = 0, tax_percentage, payment_method = 'Cash' }) {
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const settings = this.getSettings();
    const effectiveTaxRate = (tax_percentage !== undefined ? parseFloat(tax_percentage) : settings.tax_percentage) / 100;

    let subtotal = 0;
    let totalCost = 0;
    const verifiedItems = [];

    for (const item of items) {
      const prod = prods.find((p) => p.id === Number(item.id));
      if (!prod) throw new Error(`Product not found: ID ${item.id}`);

      const qty = parseInt(item.quantity, 10);
      if (qty <= 0) throw new Error(`Invalid quantity for ${prod.name}`);
      if (prod.stock_quantity < qty) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${qty}`);
      }

      const itemSubtotal = prod.selling_price * qty;
      const itemCost = prod.cost_price * qty;
      const itemProfit = (prod.selling_price - prod.cost_price) * qty;

      const itemGst = item.gst_percentage !== undefined
        ? parseFloat(item.gst_percentage)
        : (prod.gst_percentage !== undefined ? parseFloat(prod.gst_percentage) : (effectiveTaxRate * 100));

      subtotal += itemSubtotal;
      totalCost += itemCost;

      verifiedItems.push({
        product: prod,
        quantity: qty,
        selling_price: prod.selling_price,
        cost_price: prod.cost_price,
        subtotal: itemSubtotal,
        profit: itemProfit,
        gst_percentage: isNaN(itemGst) ? 0 : itemGst,
      });

      // Deduct stock
      prod.stock_quantity -= qty;
      prod.updated_at = new Date().toISOString();
    }

    setStored(STORAGE_KEYS.PRODUCTS, prods);

    const discount = Math.min(subtotal, Math.max(0, parseFloat(discount_amount) || 0));
    const discountRatio = subtotal > 0 ? (subtotal - discount) / subtotal : 1;

    let totalTaxAmount = 0;
    for (const vItem of verifiedItems) {
      const itemTaxable = vItem.subtotal * discountRatio;
      vItem.tax_amount = parseFloat((itemTaxable * (vItem.gst_percentage / 100)).toFixed(2));
      totalTaxAmount += vItem.tax_amount;
    }
    totalTaxAmount = parseFloat(totalTaxAmount.toFixed(2));

    const taxable = Math.max(0, subtotal - discount);
    const totalAmount = parseFloat((taxable + totalTaxAmount).toFixed(2));
    const netProfit = parseFloat((taxable - totalCost).toFixed(2));

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orders = getStored(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    const invoiceNo = `INV-${dateStr}-${String(orders.length + 1).padStart(4, '0')}`;

    const newOrder = {
      id: orders.length > 0 ? Math.max(...orders.map((o) => o.id || 0)) + 1 : 1,
      invoice_no: invoiceNo,
      invoiceNo,
      customer_name: customer_name ? customer_name.trim() : 'Walk-in Customer',
      customer_phone: customer_phone ? customer_phone.trim() : '',
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: discount,
      tax_amount: totalTaxAmount,
      total_amount: totalAmount,
      total_cost: parseFloat(totalCost.toFixed(2)),
      profit: netProfit,
      payment_method,
      status: 'Completed',
      created_at: new Date().toISOString(),
      items: verifiedItems.map((vi) => ({
        name: vi.product.name,
        product_name: vi.product.name,
        sku: vi.product.sku,
        quantity: vi.quantity,
        selling_price: vi.selling_price,
        cost_price: vi.cost_price,
        subtotal: vi.subtotal,
        gst_percentage: vi.gst_percentage,
        tax_amount: vi.tax_amount,
        profit: vi.profit,
      })),
    };

    orders.unshift(newOrder);
    setStored(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  },

  getOrders({ limit = 100, offset = 0 } = {}) {
    const orders = getStored(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    return orders.slice(offset, offset + limit).map((o) => ({
      ...o,
      total_items: o.items?.length || 1,
    }));
  },

  getOrderById(id) {
    const orders = getStored(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    const found = orders.find((o) => o.id === Number(id) || o.invoice_no === id);
    if (!found) throw new Error('Order not found.');
    return found;
  },

  // Comprehensive Reporting Engine: Daily, Calendar, Monthly, 1-Year (Annual)
  getPnL(params = {}) {
    const orders = getStored(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    const prods = getStored(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    const now = new Date();

    const mode = typeof params === 'string' ? params : (params.mode || 'all');
    let filteredOrders = orders;
    let reportTitle = 'All Time Summary';

    if (mode === 'calendar' && params.date) {
      // Specific calendar day
      filteredOrders = orders.filter((o) => o.created_at.slice(0, 10) === params.date);
      reportTitle = `Daily Report for ${params.date}`;
    } else if (mode === 'month' && params.month) {
      // Specific month (e.g. '2026-09')
      filteredOrders = orders.filter((o) => o.created_at.slice(0, 7) === params.month);
      reportTitle = `Monthly Report for ${params.month}`;
    } else if (mode === 'year' && params.year) {
      // 1-Year Annual Report (e.g. '2026')
      filteredOrders = orders.filter((o) => o.created_at.slice(0, 4) === String(params.year));
      reportTitle = `Annual Report for ${params.year}`;
    } else if (mode === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      filteredOrders = orders.filter((o) => o.created_at.slice(0, 10) === todayStr);
      reportTitle = `Today's Daily Report`;
    } else if (mode === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      filteredOrders = orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
      reportTitle = `Last 7 Days Report`;
    }

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const grossSales = filteredOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const totalDiscounts = filteredOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
    const totalTax = filteredOrders.reduce((sum, o) => sum + (o.tax_amount || 0), 0);
    const totalCost = filteredOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const netProfit = filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0);
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // Daily breakdown for trend
    const dailyMap = {};
    for (const o of filteredOrders) {
      const dateKey = o.created_at.slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, order_count: 0, daily_revenue: 0, daily_cost: 0, daily_profit: 0 };
      }
      dailyMap[dateKey].order_count += 1;
      dailyMap[dateKey].daily_revenue += o.total_amount || 0;
      dailyMap[dateKey].daily_cost += o.total_cost || 0;
      dailyMap[dateKey].daily_profit += o.profit || 0;
    }
    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // 1-Year Monthly Breakdown (Jan through Dec) for Annual reports
    const targetYear = params.year || now.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const annualMonthlyBreakdown = months.map((mName, mIdx) => {
      const monthPrefix = `${targetYear}-${String(mIdx + 1).padStart(2, '0')}`;
      const mOrders = orders.filter((o) => o.created_at.slice(0, 7) === monthPrefix);
      const mRevenue = mOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const mCost = mOrders.reduce((s, o) => s + (o.total_cost || 0), 0);
      const mProfit = mOrders.reduce((s, o) => s + (o.profit || 0), 0);
      const mMargin = mRevenue > 0 ? parseFloat(((mProfit / mRevenue) * 100).toFixed(1)) : 0;

      return {
        month: mName,
        monthKey: monthPrefix,
        orders_count: mOrders.length,
        revenue: parseFloat(mRevenue.toFixed(2)),
        cost: parseFloat(mCost.toFixed(2)),
        profit: parseFloat(mProfit.toFixed(2)),
        margin: mMargin,
      };
    });

    // Top profitable products
    const itemMap = {};
    for (const o of filteredOrders) {
      for (const item of o.items || []) {
        const key = item.sku || item.name;
        if (!itemMap[key]) {
          itemMap[key] = { product_name: item.name || item.product_name, sku: item.sku, units_sold: 0, total_sales: 0, total_profit: 0 };
        }
        itemMap[key].units_sold += item.quantity || 1;
        itemMap[key].total_sales += item.subtotal || 0;
        itemMap[key].total_profit += item.profit || 0;
      }
    }
    const topProfitable = Object.values(itemMap)
      .sort((a, b) => b.total_profit - a.total_profit)
      .slice(0, 8);

    const totalStock = prods.reduce((sum, p) => sum + p.stock_quantity, 0);
    const costVal = prods.reduce((sum, p) => sum + p.cost_price * p.stock_quantity, 0);
    const retailVal = prods.reduce((sum, p) => sum + p.selling_price * p.stock_quantity, 0);

    return {
      title: reportTitle,
      summary: {
        total_orders: totalOrders,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        gross_sales: parseFloat(grossSales.toFixed(2)),
        total_discounts: parseFloat(totalDiscounts.toFixed(2)),
        total_tax: parseFloat(totalTax.toFixed(2)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        net_profit: parseFloat(netProfit.toFixed(2)),
        profit_margin: profitMargin,
        is_profit: netProfit >= 0,
      },
      dailyTrend,
      annualMonthlyBreakdown,
      topProfitable,
      orders: filteredOrders,
      inventoryStats: {
        total_product_types: prods.length,
        total_items_in_stock: totalStock,
        inventory_cost_value: parseFloat(costVal.toFixed(2)),
        inventory_retail_value: parseFloat(retailVal.toFixed(2)),
        potential_profit: parseFloat((retailVal - costVal).toFixed(2)),
        low_stock_count: prods.filter((p) => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length,
        out_of_stock_count: prods.filter((p) => p.stock_quantity === 0).length,
      },
    };
  },
};
