require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thjfjhekmqwgtypbhlar.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_syLrN87RaxCMyUc-3F-N3A_79VI05q0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log(`[Database] Connected to Supabase Cloud PostgreSQL: ${SUPABASE_URL}`);

module.exports = supabase;
module.exports.supabase = supabase;
