require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper to extract user email
function getUserEmail(req) {
  return (req.headers['x-user-email'] || req.query.email || '').trim().toLowerCase();
}

// Health check and root endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MS Store Backend on Supabase',
    version: '1.0.0',
    provider: 'Supabase PostgreSQL',
    time: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MS Store API on Supabase',
    version: '1.0.0',
    provider: 'Supabase PostgreSQL',
  });
});

// ---------------------------------------------
// SETTINGS ENDPOINTS
// ---------------------------------------------
app.get('/api/settings', async (req, res) => {
  try {
    const email = getUserEmail(req) || 'default';
    const { data, error } = await supabase.from('settings').select('*').eq('user_email', email).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      return res.json({ ...data, tax_percentage: parseFloat(data.tax_percentage) || 5.0 });
    }

    const defaultSettings = {
      user_email: email,
      shop_name: 'MS Store',
      tagline: 'Smart Retail & Inventory Management',
      phone: '',
      address: '',
      currency_symbol: '₹',
      tax_percentage: 5.0,
      owner_name: '',
      owner_email: email,
      owner_pin: '',
    };

    if (getUserEmail(req)) {
      const { data: created } = await supabase.from('settings').insert(defaultSettings).select().single();
      if (created) return res.json({ ...created, tax_percentage: parseFloat(created.tax_percentage) || 5.0 });
    }

    res.json(defaultSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const body = req.body;
    const { data, error } = await supabase
      .from('settings')
      .upsert(
        {
          user_email: userEmail,
          shop_name: body.shop_name,
          tagline: body.tagline,
          phone: body.phone,
          address: body.address,
          currency_symbol: body.currency_symbol || '₹',
          tax_percentage: parseFloat(body.tax_percentage) || 0,
          owner_name: body.owner_name,
          owner_email: body.owner_email || userEmail,
          owner_pin: body.owner_pin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      )
      .select()
      .single();

    if (error) throw error;
    res.json({ ...data, tax_percentage: parseFloat(data.tax_percentage) || 5.0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// PRODUCTS ENDPOINTS
// ---------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json([]);

    let query = supabase.from('products').select('*').eq('user_email', userEmail);
    const { search, category, lowStockOnly } = req.query;

    if (search) {
      const q = search.trim();
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    let list = (data || []).map((p) => ({
      ...p,
      cost_price: parseFloat(p.cost_price),
      selling_price: parseFloat(p.selling_price),
      gst_percentage: parseFloat(p.gst_percentage),
    }));

    if (lowStockOnly === 'true') {
      list = list.filter((p) => p.stock_quantity <= p.low_stock_threshold);
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/categories', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json([]);

    const { data, error } = await supabase.from('products').select('category').eq('user_email', userEmail);
    if (error) throw error;

    const set = new Set((data || []).map((r) => r.category).filter(Boolean));
    res.json(Array.from(set).sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const { name, sku, category, cost_price, selling_price, stock_quantity, low_stock_threshold, unit, image_emoji, gst_percentage } = req.body;
    const cleanSku = String(sku || '').trim().toUpperCase();

    if (!name || !cleanSku) {
      return res.status(400).json({ error: 'Name and SKU are required.' });
    }

    const { is_bundle, bundle_items, is_grain_rice, bag_variants, allow_loose, loose_selling_price, loose_cost_price } = req.body;
    const initialStock = parseFloat(stock_quantity) || 0;
    const threshold = parseInt(low_stock_threshold, 10) || 5;
    const gstPct = gst_percentage !== undefined ? parseFloat(gst_percentage) : 5.0;

    const { data: newProd, error } = await supabase
      .from('products')
      .insert({
        user_email: userEmail,
        name: name.trim(),
        sku: cleanSku,
        category: (category || 'General').trim(),
        cost_price: parseFloat(cost_price) || 0,
        selling_price: parseFloat(selling_price) || 0,
        stock_quantity: initialStock,
        low_stock_threshold: threshold,
        unit: unit || 'pcs',
        image_emoji: image_emoji || '📦',
        gst_percentage: gstPct,
        is_bundle: Boolean(is_bundle),
        bundle_items: Array.isArray(bundle_items) ? bundle_items : [],
        is_grain_rice: Boolean(is_grain_rice),
        bag_weight_kg: req.body.bag_weight_kg !== undefined ? parseFloat(req.body.bag_weight_kg) : 50,
        open_bag_loose_kg: req.body.open_bag_loose_kg !== undefined ? parseFloat(req.body.open_bag_loose_kg) : 0,
        bag_variants: Array.isArray(bag_variants) ? bag_variants : [],
        allow_loose: allow_loose !== undefined ? Boolean(allow_loose) : true,
        loose_selling_price: loose_selling_price !== undefined && loose_selling_price !== null && loose_selling_price !== '' ? parseFloat(loose_selling_price) : null,
        loose_cost_price: loose_cost_price !== undefined && loose_cost_price !== null && loose_cost_price !== '' ? parseFloat(loose_cost_price) : null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: `Product SKU "${cleanSku}" already exists.` });
      }
      throw error;
    }

    if (initialStock > 0) {
      await supabase.from('stock_logs').insert({
        user_email: userEmail,
        product_id: newProd.id,
        type: 'INITIAL',
        quantity_change: initialStock,
        quantity_after: initialStock,
        note: 'Initial inventory stock',
      });
    }

    res.status(201).json({
      ...newProd,
      cost_price: parseFloat(newProd.cost_price),
      selling_price: parseFloat(newProd.selling_price),
      gst_percentage: parseFloat(newProd.gst_percentage),
      stock_quantity: parseFloat(newProd.stock_quantity),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const id = parseInt(req.params.id, 10);
    const body = req.body;

    const { data: current, error: getErr } = await supabase.from('products').select('*').eq('id', id).eq('user_email', userEmail).single();
    if (getErr || !current) return res.status(404).json({ error: 'Product not found.' });

    const cleanSku = body.sku ? String(body.sku).trim().toUpperCase() : current.sku;
    const newStock = body.stock_quantity !== undefined ? parseFloat(body.stock_quantity) : current.stock_quantity;
    const stockDiff = newStock - current.stock_quantity;

    const updatePayload = { sku: cleanSku, updated_at: new Date().toISOString() };
    if (body.name !== undefined) updatePayload.name = body.name.trim();
    if (body.category !== undefined) updatePayload.category = body.category.trim();
    if (body.cost_price !== undefined) updatePayload.cost_price = parseFloat(body.cost_price);
    if (body.selling_price !== undefined) updatePayload.selling_price = parseFloat(body.selling_price);
    if (body.stock_quantity !== undefined) updatePayload.stock_quantity = newStock;
    if (body.low_stock_threshold !== undefined) updatePayload.low_stock_threshold = parseInt(body.low_stock_threshold, 10);
    if (body.unit !== undefined) updatePayload.unit = body.unit;
    if (body.image_emoji !== undefined) updatePayload.image_emoji = body.image_emoji;
    if (body.gst_percentage !== undefined) updatePayload.gst_percentage = parseFloat(body.gst_percentage);
    if (body.is_bundle !== undefined) updatePayload.is_bundle = Boolean(body.is_bundle);
    if (body.bundle_items !== undefined) updatePayload.bundle_items = Array.isArray(body.bundle_items) ? body.bundle_items : [];
    if (body.is_grain_rice !== undefined) updatePayload.is_grain_rice = Boolean(body.is_grain_rice);
    if (body.bag_weight_kg !== undefined) updatePayload.bag_weight_kg = parseFloat(body.bag_weight_kg);
    if (body.open_bag_loose_kg !== undefined) updatePayload.open_bag_loose_kg = parseFloat(body.open_bag_loose_kg);
    if (body.bag_variants !== undefined) updatePayload.bag_variants = Array.isArray(body.bag_variants) ? body.bag_variants : [];
    if (body.allow_loose !== undefined) updatePayload.allow_loose = Boolean(body.allow_loose);
    if (body.loose_selling_price !== undefined) updatePayload.loose_selling_price = body.loose_selling_price !== null && body.loose_selling_price !== '' ? parseFloat(body.loose_selling_price) : null;
    if (body.loose_cost_price !== undefined) updatePayload.loose_cost_price = body.loose_cost_price !== null && body.loose_cost_price !== '' ? parseFloat(body.loose_cost_price) : null;

    const { data: updated, error: updateErr } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      if (updateErr.code === '23505') {
        return res.status(400).json({ error: `SKU "${cleanSku}" is already taken.` });
      }
      throw updateErr;
    }

    if (stockDiff !== 0) {
      await supabase.from('stock_logs').insert({
        user_email: userEmail,
        product_id: id,
        type: 'ADJUSTMENT',
        quantity_change: stockDiff,
        quantity_after: newStock,
        note: 'Manual stock edit',
      });
    }

    res.json({
      ...updated,
      cost_price: parseFloat(updated.cost_price),
      selling_price: parseFloat(updated.selling_price),
      gst_percentage: parseFloat(updated.gst_percentage),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/products/:id/stock', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const id = parseInt(req.params.id, 10);
    const { delta, newStock, note, type } = req.body;

    const { data: product, error: getErr } = await supabase.from('products').select('*').eq('id', id).eq('user_email', userEmail).single();
    if (getErr || !product) return res.status(404).json({ error: 'Product not found.' });

    let updatedQty;
    let change;

    if (delta !== undefined) {
      change = parseInt(delta, 10);
      updatedQty = product.stock_quantity + change;
    } else if (newStock !== undefined) {
      updatedQty = parseInt(newStock, 10);
      change = updatedQty - product.stock_quantity;
    } else {
      return res.status(400).json({ error: 'Provide delta or newStock.' });
    }

    if (updatedQty < 0) return res.status(400).json({ error: 'Stock quantity cannot be negative.' });

    const { data: updated, error: updateErr } = await supabase
      .from('products')
      .update({ stock_quantity: updatedQty, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const logType = type || (change > 0 ? 'RESTOCK' : 'ADJUSTMENT');
    await supabase.from('stock_logs').insert({
      user_email: userEmail,
      product_id: id,
      type: logType,
      quantity_change: change,
      quantity_after: updatedQty,
      note: note || `Quick stock ${change >= 0 ? '+' + change : change}`,
    });

    res.json({
      ...updated,
      cost_price: parseFloat(updated.cost_price),
      selling_price: parseFloat(updated.selling_price),
      gst_percentage: parseFloat(updated.gst_percentage),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/:id/open-bag', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const id = parseInt(req.params.id, 10);
    const { bags = 1 } = req.body;

    const { data, error } = await supabase.rpc('open_sealed_bag_for_loose', {
      p_product_id: id,
      p_user_email: userEmail,
      p_bags_to_open: parseInt(bags, 10) || 1,
    });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const id = parseInt(req.params.id, 10);
    const { data, error } = await supabase.from('products').delete().eq('id', id).eq('user_email', userEmail).select().single();
    if (error) throw error;
    res.json({ message: 'Product deleted successfully.', product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// INVENTORY AUDIT & ACTIVITY LOGS
// ---------------------------------------------
app.get('/api/inventory/logs', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const limit = parseInt(req.query.limit || '100', 10);
    const { data: logs, error } = await supabase
      .from('stock_logs')
      .select('*, products(name, sku, category)')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json(
      (logs || []).map((l) => ({
        ...l,
        product_name: l.products?.name || 'Item',
        product_sku: l.products?.sku || '',
        category: l.products?.category || 'General',
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// ORDERS / BILLING ENDPOINTS
// ---------------------------------------------
app.post('/api/orders', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const {
      items,
      customer_name,
      customer_phone,
      discount_amount = 0,
      tax_percentage,
      payment_method = 'Cash',
      counter_name = 'Counter 1',
      loyalty_points_earned = 0,
      loyalty_points_redeemed = 0,
      loyalty_discount_amount = 0,
    } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Add items to create a bill.' });
    }

    const { data: settings } = await supabase.from('settings').select('*').eq('user_email', userEmail).maybeSingle();
    const effectiveTaxRate = (tax_percentage !== undefined ? parseFloat(tax_percentage) : (settings?.tax_percentage || 5.0)) / 100;

    const itemIds = items.map((i) => i.id);
    const { data: dbProducts, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', itemIds)
      .eq('user_email', userEmail);

    if (prodErr) throw prodErr;
    const productMap = new Map((dbProducts || []).map((p) => [p.id, p]));

    let subtotal = 0;
    let totalCost = 0;
    const verifiedItems = [];

    for (const item of items) {
      const prod = productMap.get(item.id);
      if (!prod) return res.status(400).json({ error: `Product not found (ID: ${item.id})` });

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: `Invalid quantity for ${prod.name}` });

      const bagWeight = item.bag_weight ? parseFloat(item.bag_weight) : null;
      const isLoose = Boolean(item.is_loose);
      const isGrain = Boolean(prod.is_grain_rice);

      // Determine stock deduction quantity (in kg or pcs)
      let stockDeductQty = qty;
      let displayName = prod.name;
      let sellingPrice = parseFloat(prod.selling_price);
      let costPrice = parseFloat(prod.cost_price);

      if (isGrain && isLoose) {
        displayName = item.display_name || `${prod.name} (Loose)`;
        stockDeductQty = qty; // in kg
        if (item.selling_price !== undefined) {
          sellingPrice = parseFloat(item.selling_price);
        } else if (prod.loose_selling_price !== null && prod.loose_selling_price !== undefined) {
          sellingPrice = parseFloat(prod.loose_selling_price);
        } else {
          sellingPrice = 30;
        }

        const bagWt = parseFloat(prod.bag_weight_kg) || 50;
        if (item.cost_price !== undefined) {
          costPrice = parseFloat(item.cost_price);
        } else if (prod.loose_cost_price !== null && prod.loose_cost_price !== undefined) {
          costPrice = parseFloat(prod.loose_cost_price);
        } else {
          costPrice = parseFloat((parseFloat(prod.cost_price) / bagWt).toFixed(2));
        }

        // Available loose capacity = loose in open bag + (sealed bags * bag_weight)
        const totalCapacityKg = (parseFloat(prod.stock_quantity) || 0) * bagWt + (parseFloat(prod.open_bag_loose_kg) || 0);
        if (totalCapacityKg < qty) {
          return res.status(400).json({
            error: `Insufficient stock for "${displayName}". Needed: ${qty} kg, Total Available in store: ${totalCapacityKg} kg`,
          });
        }
      } else if (isGrain && !isLoose) {
        const bagWt = bagWeight || parseFloat(prod.bag_weight_kg) || 50;
        displayName = item.display_name || `${prod.name} (${bagWt} kg Sealed Bag)`;
        stockDeductQty = qty; // in bags

        if (item.selling_price !== undefined) {
          sellingPrice = parseFloat(item.selling_price);
        } else {
          sellingPrice = parseFloat(prod.selling_price);
        }

        if (item.cost_price !== undefined) {
          costPrice = parseFloat(item.cost_price);
        } else {
          costPrice = parseFloat(prod.cost_price);
        }

        // Available sealed bags check
        const availBags = parseFloat(prod.stock_quantity) || 0;
        if (availBags < qty) {
          return res.status(400).json({
            error: `Insufficient sealed bags for "${displayName}". Available: ${availBags} bags, Needed: ${qty} bags`,
          });
        }
      } else {
        if (item.selling_price !== undefined) {
          sellingPrice = parseFloat(item.selling_price);
        }
        if (!prod.is_bundle && parseFloat(prod.stock_quantity) < qty) {
          return res.status(400).json({
            error: `Insufficient stock for "${displayName}". Available: ${prod.stock_quantity} ${prod.unit || 'units'}, Needed: ${qty} ${prod.unit || 'units'}`,
          });
        }
      }
      
      // If combo bundle, compute component cost if not set
      if (prod.is_bundle && costPrice <= 0 && Array.isArray(prod.bundle_items) && prod.bundle_items.length > 0) {
        const compIds = prod.bundle_items.map((b) => b.product_id).filter(Boolean);
        if (compIds.length > 0) {
          const { data: comps } = await supabase.from('products').select('id, cost_price').in('id', compIds);
          const cMap = new Map((comps || []).map((c) => [c.id, parseFloat(c.cost_price) || 0]));
          costPrice = prod.bundle_items.reduce((s, bi) => s + (cMap.get(bi.product_id) || 0) * (parseFloat(bi.quantity) || 1), 0);
        }
      }

      const itemSubtotal = sellingPrice * qty;
      const itemCost = costPrice * qty;
      const itemProfit = (sellingPrice - costPrice) * qty;

      const itemGst = item.gst_percentage !== undefined
        ? parseFloat(item.gst_percentage)
        : (prod.gst_percentage !== undefined ? parseFloat(prod.gst_percentage) : (effectiveTaxRate * 100));

      subtotal += itemSubtotal;
      totalCost += itemCost;

      verifiedItems.push({
        id: prod.id,
        name: displayName,
        sku: prod.sku,
        selling_price: sellingPrice,
        cost_price: costPrice,
        quantity: qty,
        subtotal: itemSubtotal,
        profit: itemProfit,
        gst_percentage: isNaN(itemGst) ? 0 : itemGst,
        stock_deduct_quantity: stockDeductQty,
        bag_weight: bagWeight,
        is_loose: isLoose,
      });
    }

    const totalDiscountDeduction = (parseFloat(discount_amount) || 0) + (parseFloat(loyalty_discount_amount) || 0);
    const discount = Math.min(subtotal, Math.max(0, totalDiscountDeduction));
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
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', userEmail)
      .ilike('invoice_no', `INV-${dateStr}%`);

    const nextSeq = (count || 0) + 1;
    const invoiceNo = `INV-${dateStr}-${String(nextSeq).padStart(4, '0')}`;

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('process_order_checkout', {
      p_user_email: userEmail,
      p_customer_name: customer_name ? customer_name.trim() : 'Walk-in Customer',
      p_customer_phone: customer_phone ? customer_phone.trim() : '',
      p_subtotal: parseFloat(subtotal.toFixed(2)),
      p_discount_amount: discount,
      p_tax_amount: totalTaxAmount,
      p_total_amount: totalAmount,
      p_total_cost: parseFloat(totalCost.toFixed(2)),
      p_profit: netProfit,
      p_payment_method: payment_method || 'Cash',
      p_invoice_no: invoiceNo,
      p_items: verifiedItems,
      p_counter_name: counter_name || 'Counter 1',
      p_loyalty_earned: parseFloat(loyalty_points_earned) || 0,
      p_loyalty_redeemed: parseFloat(loyalty_points_redeemed) || 0,
      p_loyalty_discount: parseFloat(loyalty_discount_amount) || 0,
    });

    if (rpcErr) throw rpcErr;

    res.status(201).json({
      orderId: rpcRes?.orderId,
      invoiceNo,
      invoice_no: invoiceNo,
      counter_name: counter_name || 'Counter 1',
      customer_name: customer_name || 'Walk-in Customer',
      customer_phone: customer_phone || '',
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: discount,
      tax_amount: totalTaxAmount,
      total_amount: totalAmount,
      total_cost: parseFloat(totalCost.toFixed(2)),
      profit: netProfit,
      payment_method: payment_method || 'Cash',
      loyalty_points_earned: rpcRes?.loyalty_points_earned ?? (parseFloat(loyalty_points_earned) || 0),
      loyalty_points_redeemed: rpcRes?.loyalty_points_redeemed ?? (parseFloat(loyalty_points_redeemed) || 0),
      loyalty_discount_amount: parseFloat(loyalty_discount_amount) || 0,
      customer_points_balance: rpcRes?.customer_points_balance ?? 0,
      created_at: new Date().toISOString(),
      items: verifiedItems.map((vi) => ({
        name: vi.name,
        product_name: vi.name,
        sku: vi.sku,
        quantity: vi.quantity,
        selling_price: vi.selling_price,
        cost_price: vi.cost_price,
        subtotal: vi.subtotal,
        gst_percentage: vi.gst_percentage,
        tax_amount: vi.tax_amount,
        profit: vi.profit,
        bag_weight: vi.bag_weight,
        is_loose: vi.is_loose,
        stock_deduct_quantity: vi.stock_deduct_quantity,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// CUSTOMER CRM & LOYALTY POINTS ENDPOINTS
// ---------------------------------------------
app.get('/api/customers', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json([]);

    const search = (req.query.search || '').trim().toLowerCase();
    const limit = parseInt(req.query.limit || '100', 10);

    let query = supabase
      .from('customers')
      .select('*')
      .eq('user_email', userEmail)
      .order('points_balance', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json((data || []).map((c) => ({
      ...c,
      points_balance: parseFloat(c.points_balance) || 0,
      total_spent: parseFloat(c.total_spent) || 0,
      visit_count: parseInt(c.visit_count) || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/lookup/:phone', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json(null);

    const cleanPhone = (req.params.phone || '').trim();
    if (!cleanPhone) return res.json(null);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_email', userEmail)
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    res.json({
      ...data,
      points_balance: parseFloat(data.points_balance) || 0,
      total_spent: parseFloat(data.total_spent) || 0,
      visit_count: parseInt(data.visit_count) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const { name, phone, points_balance } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Customer phone number is required.' });
    }

    const { data, error } = await supabase
      .from('customers')
      .upsert({
        user_email: userEmail,
        name: name ? name.trim() : 'Valued Customer',
        phone: phone.trim(),
        points_balance: parseFloat(points_balance) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email,phone' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/customers/:id/points', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const custId = req.params.id;
    const { points_delta, points_balance } = req.body;

    const { data: cust, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', custId)
      .eq('user_email', userEmail)
      .single();

    if (fetchErr || !cust) return res.status(404).json({ error: 'Customer not found.' });

    let newBalance = cust.points_balance;
    if (points_balance !== undefined) {
      newBalance = Math.max(0, parseFloat(points_balance) || 0);
    } else if (points_delta !== undefined) {
      newBalance = Math.max(0, (parseFloat(cust.points_balance) || 0) + (parseFloat(points_delta) || 0));
    }

    const { data: updated, error: updateErr } = await supabase
      .from('customers')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', custId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json([]);

    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(count)')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json((data || []).map((o) => ({
      ...o,
      subtotal: parseFloat(o.subtotal),
      discount_amount: parseFloat(o.discount_amount),
      tax_amount: parseFloat(o.tax_amount),
      total_amount: parseFloat(o.total_amount),
      total_cost: parseFloat(o.total_cost),
      profit: parseFloat(o.profit),
      total_items: o.order_items?.[0]?.count || 1,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const idOrInv = req.params.id;
    let query = supabase.from('orders').select('*').eq('user_email', userEmail);
    if (!isNaN(Number(idOrInv)) && !idOrInv.startsWith('INV-')) {
      query = query.eq('id', parseInt(idOrInv, 10));
    } else {
      query = query.eq('invoice_no', idOrInv);
    }

    const { data: order, error } = await query.single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsErr) throw itemsErr;

    res.json({
      ...order,
      subtotal: parseFloat(order.subtotal),
      discount_amount: parseFloat(order.discount_amount),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount),
      total_cost: parseFloat(order.total_cost),
      profit: parseFloat(order.profit),
      items: (items || []).map((i) => ({
        ...i,
        name: i.product_name,
        cost_price: parseFloat(i.cost_price),
        selling_price: parseFloat(i.selling_price),
        subtotal: parseFloat(i.subtotal),
        gst_percentage: parseFloat(i.gst_percentage),
        tax_amount: parseFloat(i.tax_amount),
        profit: parseFloat(i.profit),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process Sales Return / Item Exchange & Issue Credit Note
app.post('/api/orders/:id/return', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const orderId = req.params.id;
    const { items = [], refund_type = 'Cash', reason = 'Customer Return', note = '' } = req.body;
    if (!items.length) return res.status(400).json({ error: 'No items selected for return' });

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .eq('user_email', userEmail)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'Order not found' });

    let totalRefundAmount = 0;
    let totalCostReversed = 0;
    const returnedSummary = [];

    for (const item of items) {
      const returnQty = parseFloat(item.quantity) || 0;
      if (returnQty <= 0) continue;

      const orderItem = (order.order_items || []).find(
        (oi) => oi.id === item.order_item_id || oi.product_id === item.product_id
      );
      if (!orderItem) continue;

      const unitSelling = parseFloat(orderItem.selling_price) || 0;
      const unitCost = parseFloat(orderItem.cost_price) || 0;
      const gstPct = parseFloat(orderItem.gst_percentage) || 0;

      const itemSubtotal = unitSelling * returnQty;
      const itemTax = itemSubtotal * (gstPct / 100);
      const itemRefund = itemSubtotal + itemTax;
      const itemCost = unitCost * returnQty;

      totalRefundAmount += itemRefund;
      totalCostReversed += itemCost;

      // Restock product if not marked as discarded
      if (item.restock !== false) {
        const { data: currentProd } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', orderItem.product_id)
          .eq('user_email', userEmail)
          .single();

        if (currentProd) {
          const newQty = (currentProd.stock_quantity || 0) + returnQty;
          await supabase
            .from('products')
            .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', orderItem.product_id);

          await supabase.from('stock_logs').insert({
            user_email: userEmail,
            product_id: orderItem.product_id,
            type: 'RETURN',
            quantity_change: returnQty,
            quantity_after: newQty,
            note: `Returned from invoice ${order.invoice_no} (${reason})`,
          });
        }
      }

      returnedSummary.push({
        product_name: orderItem.product_name,
        quantity: returnQty,
        refund: itemRefund,
        reason,
      });
    }

    // Update order totals
    const newTotal = Math.max(0, parseFloat((order.total_amount - totalRefundAmount).toFixed(2)));
    const newCost = Math.max(0, parseFloat((order.total_cost - totalCostReversed).toFixed(2)));
    const newProfit = parseFloat((newTotal - newCost).toFixed(2));

    await supabase
      .from('orders')
      .update({
        total_amount: newTotal,
        total_cost: newCost,
        profit: newProfit,
        payment_method: `${order.payment_method} (Returned ${totalRefundAmount > 0 ? 'Partial' : ''})`,
      })
      .eq('id', order.id);

    const creditNoteNo = `CN-${Date.now().toString().slice(-6)}`;

    res.json({
      success: true,
      credit_note_no: creditNoteNo,
      original_invoice: order.invoice_no,
      customer_name: order.customer_name,
      refund_amount: parseFloat(totalRefundAmount.toFixed(2)),
      refund_type,
      returned_items: returnedSummary,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all bill history alone
// Delete all bill history alone
app.delete(['/api/orders', '/api/orders/clear'], async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const password = req.headers['x-auth-password'] || req.body?.password || req.query?.password || '';
    if (!password) {
      return res.status(401).json({ error: 'Account password is required to delete bill history.' });
    }

    const { data: userRec, error: userErr } = await supabase.from('users').select('password').eq('email', userEmail).maybeSingle();
    if (userErr || !userRec) return res.status(404).json({ error: 'User account not found.' });
    if (userRec.password !== password.trim()) {
      return res.status(403).json({ error: 'Incorrect account password. Bill history was not deleted.' });
    }

    const { error: delErr } = await supabase.from('orders').delete().eq('user_email', userEmail);
    if (delErr) throw delErr;
    await supabase.from('stock_logs').delete().eq('user_email', userEmail).eq('type', 'SALE');
    res.json({ success: true, message: 'All bill history and sales transactions cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete single bill / order with password verification
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });
    const idOrInv = req.params.id;

    const password = req.headers['x-auth-password'] || req.body?.password || req.query?.password || '';
    if (!password) {
      return res.status(401).json({ error: 'Account password is required to delete this invoice.' });
    }

    const { data: userRec, error: userErr } = await supabase.from('users').select('password').eq('email', userEmail).maybeSingle();
    if (userErr || !userRec) return res.status(404).json({ error: 'User account not found.' });
    if (userRec.password !== password.trim()) {
      return res.status(403).json({ error: 'Incorrect account password. Invoice was not deleted.' });
    }

    let query = supabase.from('orders').select('*').eq('user_email', userEmail);
    if (!isNaN(Number(idOrInv)) && !idOrInv.startsWith('INV-')) {
      query = query.eq('id', parseInt(idOrInv, 10));
    } else {
      query = query.eq('invoice_no', idOrInv);
    }
    const { data: orderToDel } = await query.maybeSingle();
    if (!orderToDel) return res.status(404).json({ error: `Invoice ${idOrInv} not found.` });

    // Restore inventory stock
    const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderToDel.id);
    for (const it of orderItems || []) {
      if (it.product_id && it.quantity > 0) {
        const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', it.product_id).maybeSingle();
        if (p) {
          const restored = p.stock_quantity + it.quantity;
          await supabase.from('products').update({ stock_quantity: restored }).eq('id', it.product_id);
          await supabase.from('stock_logs').insert({
            user_email: userEmail,
            product_id: it.product_id,
            type: 'RESTOCK',
            quantity_change: it.quantity,
            quantity_after: restored,
            note: `Restored stock from deleted invoice ${orderToDel.invoice_no}`
          });
        }
      }
    }

    const { error: delErr } = await supabase.from('orders').delete().eq('id', orderToDel.id);
    if (delErr) throw delErr;

    await supabase.from('stock_logs').delete().eq('user_email', userEmail).ilike('note', `%${orderToDel.invoice_no}%`);
    res.json({ success: true, message: `Invoice ${orderToDel.invoice_no} deleted successfully and inventory stock restored.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// PROFIT & LOSS (PnL) ANALYTICS ENDPOINT
// ---------------------------------------------
app.get('/api/analytics/pnl', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.json({
        title: 'All Time Financial Summary',
        summary: { total_orders: 0, total_revenue: 0, gross_sales: 0, total_discounts: 0, total_tax: 0, total_cost: 0, net_profit: 0, profit_margin: 0, is_profit: true },
        dailyTrend: [],
        annualMonthlyBreakdown: [],
        topProfitable: [],
        orders: [],
        inventoryStats: { total_product_types: 0, total_items_in_stock: 0, inventory_cost_value: 0, inventory_retail_value: 0, potential_profit: 0, low_stock_count: 0, out_of_stock_count: 0 },
      });
    }

    const { mode = 'all', range = 'all', date: selectedDate, month: selectedMonth, year: selectedYear } = req.query;
    const effectiveMode = mode !== 'all' ? mode : range;

    const { data: allOrders, error: orderErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (orderErr) throw orderErr;

    const { data: allProducts, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('user_email', userEmail);

    if (prodErr) throw prodErr;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let filteredOrders = allOrders || [];
    let reportTitle = 'All Time Financial Summary';

    if (effectiveMode === 'calendar' && selectedDate) {
      filteredOrders = filteredOrders.filter((o) => o.created_at.slice(0, 10) === selectedDate);
      reportTitle = `Daily Report for ${selectedDate}`;
    } else if (effectiveMode === 'month' && selectedMonth) {
      filteredOrders = filteredOrders.filter((o) => o.created_at.slice(0, 7) === selectedMonth);
      reportTitle = `Monthly Report for ${selectedMonth}`;
    } else if (effectiveMode === 'year' && selectedYear) {
      filteredOrders = filteredOrders.filter((o) => o.created_at.slice(0, 4) === String(selectedYear));
      reportTitle = `Annual Report for ${selectedYear}`;
    } else if (effectiveMode === 'today') {
      filteredOrders = filteredOrders.filter((o) => o.created_at.slice(0, 10) === todayStr);
      reportTitle = "Today's Daily Report";
    } else if (effectiveMode === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      filteredOrders = filteredOrders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
      reportTitle = 'Last 7 Days Report';
    }

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const grossSales = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.subtotal) || 0), 0);
    const totalDiscounts = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.discount_amount) || 0), 0);
    const totalTax = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.tax_amount) || 0), 0);
    const totalCost = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total_cost) || 0), 0);
    const netProfit = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.profit) || 0), 0);
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    const dailyMap = {};
    for (const o of filteredOrders) {
      const dKey = o.created_at.slice(0, 10);
      if (!dailyMap[dKey]) {
        dailyMap[dKey] = { date: dKey, order_count: 0, daily_revenue: 0, daily_cost: 0, daily_profit: 0 };
      }
      dailyMap[dKey].order_count += 1;
      dailyMap[dKey].daily_revenue += parseFloat(o.total_amount) || 0;
      dailyMap[dKey].daily_cost += parseFloat(o.total_cost) || 0;
      dailyMap[dKey].daily_profit += parseFloat(o.profit) || 0;
    }

    const dailyTrend = Object.values(dailyMap)
      .map((d) => ({
        ...d,
        daily_revenue: parseFloat(d.daily_revenue.toFixed(2)),
        daily_cost: parseFloat(d.daily_cost.toFixed(2)),
        daily_profit: parseFloat(d.daily_profit.toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const targetYear = selectedYear || now.getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const annualMonthlyBreakdown = monthNames.map((mName, mIdx) => {
      const monthPrefix = `${targetYear}-${String(mIdx + 1).padStart(2, '0')}`;
      const mOrders = (allOrders || []).filter((o) => o.created_at.slice(0, 7) === monthPrefix);
      const mRev = mOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
      const mCost = mOrders.reduce((s, o) => s + (parseFloat(o.total_cost) || 0), 0);
      const mProfit = mOrders.reduce((s, o) => s + (parseFloat(o.profit) || 0), 0);
      const mMargin = mRev > 0 ? parseFloat(((mProfit / mRev) * 100).toFixed(1)) : 0;

      return {
        month: mName,
        monthKey: monthPrefix,
        orders_count: mOrders.length,
        revenue: parseFloat(mRev.toFixed(2)),
        cost: parseFloat(mCost.toFixed(2)),
        profit: parseFloat(mProfit.toFixed(2)),
        margin: mMargin,
      };
    });

    const itemMap = {};
    for (const o of filteredOrders) {
      for (const item of o.order_items || []) {
        const key = item.sku || item.product_name;
        if (!itemMap[key]) {
          itemMap[key] = {
            product_name: item.product_name,
            sku: item.sku,
            units_sold: 0,
            total_sales: 0,
            total_profit: 0,
          };
        }
        itemMap[key].units_sold += item.quantity || 1;
        itemMap[key].total_sales += parseFloat(item.subtotal) || 0;
        itemMap[key].total_profit += parseFloat(item.profit) || 0;
      }
    }

    const topProfitable = Object.values(itemMap)
      .map((i) => ({
        ...i,
        total_sales: parseFloat(i.total_sales.toFixed(2)),
        total_profit: parseFloat(i.total_profit.toFixed(2)),
      }))
      .sort((a, b) => b.total_profit - a.total_profit)
      .slice(0, 8);

    const prods = allProducts || [];
    const totalStock = prods.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
    const costVal = prods.reduce((sum, p) => sum + ((parseFloat(p.cost_price) || 0) * (p.stock_quantity || 0)), 0);
    const retailVal = prods.reduce((sum, p) => sum + ((parseFloat(p.selling_price) || 0) * (p.stock_quantity || 0)), 0);

    res.json({
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
      orders: filteredOrders.map((o) => ({
        ...o,
        subtotal: parseFloat(o.subtotal),
        discount_amount: parseFloat(o.discount_amount),
        tax_amount: parseFloat(o.tax_amount),
        total_amount: parseFloat(o.total_amount),
        total_cost: parseFloat(o.total_cost),
        profit: parseFloat(o.profit),
      })),
      inventoryStats: {
        total_product_types: prods.length,
        total_items_in_stock: totalStock,
        inventory_cost_value: parseFloat(costVal.toFixed(2)),
        inventory_retail_value: parseFloat(retailVal.toFixed(2)),
        potential_profit: parseFloat((retailVal - costVal).toFixed(2)),
        low_stock_count: prods.filter((p) => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length,
        out_of_stock_count: prods.filter((p) => p.stock_quantity === 0).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// AI REORDER & DEPLETION FORECASTING
// ---------------------------------------------
app.get('/api/analytics/reorder-forecast', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('user_email', userEmail);
    if (prodErr) throw prodErr;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentOrders, error: orderErr } = await supabase
      .from('orders')
      .select('id, created_at, order_items(product_id, quantity)')
      .eq('user_email', userEmail)
      .gte('created_at', thirtyDaysAgo);
    if (orderErr) throw orderErr;

    const salesMap = {};
    (recentOrders || []).forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const pId = item.product_id;
        const qty = parseFloat(item.quantity) || 0;
        salesMap[pId] = (salesMap[pId] || 0) + qty;
      });
    });

    const forecastList = (products || []).map((p) => {
      const sold30d = salesMap[p.id] || 0;
      const dailyVelocity = parseFloat((sold30d / 30).toFixed(2));
      const currentStock = p.stock_quantity || 0;
      const costPrice = parseFloat(p.cost_price) || 0;
      const sellingPrice = parseFloat(p.selling_price) || 0;

      let daysRemaining = dailyVelocity > 0 ? parseFloat((currentStock / dailyVelocity).toFixed(1)) : 999;
      let urgency = 'HEALTHY';
      if (currentStock === 0) {
        urgency = 'OUT_OF_STOCK';
      } else if (daysRemaining <= 3 || currentStock <= p.low_stock_threshold) {
        urgency = 'CRITICAL';
      } else if (daysRemaining <= 7) {
        urgency = 'LOW';
      } else if (sold30d === 0 && currentStock > 0) {
        urgency = 'SLOW_MOVING';
      }

      const targetBuffer = Math.max(10, Math.ceil(dailyVelocity * 14));
      const recommendedQty = Math.max(0, targetBuffer - currentStock);
      const estimatedCost = parseFloat((recommendedQty * costPrice).toFixed(2));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit || 'pcs',
        current_stock: currentStock,
        low_stock_threshold: p.low_stock_threshold,
        cost_price: costPrice,
        selling_price: sellingPrice,
        units_sold_30d: sold30d,
        daily_velocity: dailyVelocity,
        days_remaining: daysRemaining,
        urgency,
        recommended_reorder_qty: recommendedQty,
        estimated_reorder_cost: estimatedCost,
      };
    });

    const urgencyWeight = { OUT_OF_STOCK: 1, CRITICAL: 2, LOW: 3, HEALTHY: 4, SLOW_MOVING: 5 };
    forecastList.sort((a, b) => (urgencyWeight[a.urgency] || 99) - (urgencyWeight[b.urgency] || 99));

    const totalCritical = forecastList.filter((f) => f.urgency === 'CRITICAL' || f.urgency === 'OUT_OF_STOCK').length;
    const totalRecommendedCost = forecastList.reduce((sum, f) => sum + f.estimated_reorder_cost, 0);

    res.json({
      items: forecastList,
      summary: {
        total_products: forecastList.length,
        critical_count: totalCritical,
        total_recommended_cost: parseFloat(totalRecommendedCost.toFixed(2)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// PUBLIC STOREFRONT & WHATSAPP CATALOG
// ---------------------------------------------
app.get('/api/public/store', async (req, res) => {
  try {
    const email = (req.query.email || req.query.shop || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Store email or shop identifier is required' });
    }

    const { data: settings } = await supabase
      .from('settings')
      .select('shop_name, tagline, phone, address, currency_symbol')
      .eq('user_email', email)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('shop_name, phone, name')
      .eq('email', email)
      .maybeSingle();

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, sku, category, selling_price, stock_quantity, unit, gst_percentage')
      .eq('user_email', email);

    if (pErr) throw pErr;

    res.json({
      shop: {
        email,
        shop_name: settings?.shop_name || user?.shop_name || 'MS Store',
        tagline: settings?.tagline || 'Online Store & Catalog',
        phone: settings?.phone || user?.phone || '',
        address: settings?.address || '',
        currency_symbol: settings?.currency_symbol || '₹',
      },
      products: (products || []).filter((p) => p.stock_quantity > 0).map((p) => ({
        ...p,
        selling_price: parseFloat(p.selling_price) || 0,
      })),
      categories: [...new Set((products || []).map((p) => p.category).filter(Boolean))],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/orders', async (req, res) => {
  try {
    const { store_email, customer_name, customer_phone, customer_address, items } = req.body;
    if (!store_email) return res.status(400).json({ error: 'Store email is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const { data: settings } = await supabase.from('settings').select('*').eq('user_email', store_email).maybeSingle();
    const taxRate = parseFloat(settings?.tax_percentage) || 5.0;

    const productIds = items.map((i) => i.id);
    const { data: dbProducts } = await supabase
      .from('products')
      .select('*')
      .eq('user_email', store_email)
      .in('id', productIds);

    const prodMap = {};
    (dbProducts || []).forEach((p) => {
      prodMap[p.id] = p;
    });

    let subtotal = 0;
    let totalCost = 0;
    const orderItems = [];

    for (const item of items) {
      const p = prodMap[item.id];
      if (!p) continue;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      const sellPrice = parseFloat(p.selling_price) || 0;
      const costPrice = parseFloat(p.cost_price) || 0;
      const itemSubtotal = sellPrice * qty;
      const gstPct = p.gst_percentage !== undefined ? parseFloat(p.gst_percentage) : taxRate;
      const taxAmt = itemSubtotal * (gstPct / 100);
      const profit = (sellPrice - costPrice) * qty;

      subtotal += itemSubtotal;
      totalCost += costPrice * qty;

      orderItems.push({
        product_id: p.id,
        product_name: p.name,
        quantity: qty,
        cost_price: costPrice,
        selling_price: sellPrice,
        subtotal: itemSubtotal,
        gst_percentage: gstPct,
        tax_amount: taxAmt,
        profit,
      });
    }

    const taxAmount = orderItems.reduce((acc, i) => acc + i.tax_amount, 0);
    const totalAmount = subtotal + taxAmount;
    const invoiceNo = `WA-${Date.now().toString().slice(-6)}`;

    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_email: store_email,
        invoice_no: invoiceNo,
        customer_name: customer_name || 'Online Customer',
        customer_phone: customer_phone || '',
        subtotal,
        discount_amount: 0,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        total_cost: totalCost,
        profit: subtotal - totalCost,
        payment_method: 'WhatsApp / Cash on Delivery',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    const itemsToInsert = orderItems.map((i) => ({ ...i, order_id: newOrder.id }));
    await supabase.from('order_items').insert(itemsToInsert);

    for (const item of items) {
      const p = prodMap[item.id];
      if (p) {
        const newStock = Math.max(0, (p.stock_quantity || 0) - item.quantity);
        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', p.id);
      }
    }

    res.json({
      success: true,
      invoice_no: invoiceNo,
      order_id: newOrder.id,
      total_amount: totalAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// AUTH & USERS
// ---------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, shop_name, phone } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const cleanName = (name || '').trim();
    const cleanShop = (shop_name || 'MS Store').trim();
    const cleanPhone = (phone || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) return res.status(400).json({ error: 'Valid email is required.' });
    if (!cleanPassword || cleanPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    if (!cleanName) return res.status(400).json({ error: 'Full name is required.' });

    const { data: existing } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle();
    if (existing) return res.status(400).json({ error: `An account with email "${cleanEmail}" already exists. Please Log In.` });

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
        shop_name: cleanShop,
        phone: cleanPhone,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    const { data: existingSettings } = await supabase.from('settings').select('id').eq('user_email', cleanEmail).maybeSingle();
    if (!existingSettings) {
      await supabase.from('settings').insert({
        user_email: cleanEmail,
        shop_name: cleanShop,
        owner_name: cleanName,
        owner_email: cleanEmail,
        phone: cleanPhone,
        currency_symbol: '₹',
        tax_percentage: 5.0,
      });
    }

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        shop_name: newUser.shop_name,
        phone: newUser.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) return res.status(400).json({ error: 'Please enter both email and password.' });

    const { data: user, error } = await supabase.from('users').select('*').eq('email', cleanEmail).maybeSingle();
    if (error) throw error;
    if (!user || user.password !== cleanPassword) {
      return res.status(401).json({ error: 'Invalid email or password. Please verify and try again.' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        shop_name: user.shop_name,
        phone: user.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.json({ user: null });
    const { data: user } = await supabase.from('users').select('id, email, name, shop_name, phone').eq('email', userEmail).maybeSingle();
    res.json({ user: user || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/profile', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { data: settings } = await supabase.from('settings').select('*').eq('user_email', userEmail || 'default').maybeSingle();
    res.json({
      owner_name: settings?.owner_name || '',
      owner_email: settings?.owner_email || '',
      owner_pin: settings?.owner_pin || '',
      owner_phone: settings?.phone || '',
      shop_name: settings?.shop_name || 'MS Store',
      is_configured: Boolean(settings?.owner_email && settings?.owner_pin),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/reset', async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) return res.status(401).json({ error: 'Authentication required' });

    const password = req.headers['x-auth-password'] || req.body?.password || req.query?.password || '';
    if (!password) {
      return res.status(401).json({ error: 'Account password is required to reset store data.' });
    }

    const { data: userRec, error: userErr } = await supabase.from('users').select('password').eq('email', userEmail).maybeSingle();
    if (userErr || !userRec) return res.status(404).json({ error: 'User account not found.' });

    if (userRec.password !== password.trim()) {
      return res.status(403).json({ error: 'Incorrect account password. Store was not reset.' });
    }

    await supabase.from('orders').delete().eq('user_email', userEmail);
    await supabase.from('stock_logs').delete().eq('user_email', userEmail);
    await supabase.from('products').delete().eq('user_email', userEmail);
    res.json({ success: true, message: 'All store inventory and sales data wiped clean.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MS Store API Server running on port ${PORT} (0.0.0.0) with Supabase Cloud DB`);
});
