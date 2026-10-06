// 只填写公开配置。不要把 PayPal Secret 放这里。
const CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  PAYPAL_CLIENT_ID: "YOUR_PAYPAL_CLIENT_ID",
  CURRENCY: "USD"
};
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
