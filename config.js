// 只填写公开配置。不要把 PayPal Secret 放这里。
const CONFIG = {
  SUPABASE_URL: "https://igyjocxgmwdyqiftdajs.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_LMUXDcRYaW5malymPtg0CQ_mFr0zw8j",
  PAYPAL_CLIENT_ID: "BAAKAnFzMzfWdUkeUVZjUoDq0t-wzmSf5DzhkhwCqXzU6Ps2TAgB8YVlVs9fssnTWDsY7X94N2BZj95qEk",
  CURRENCY: "USD"
};
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
