window.SupabaseConfig = {
  url: 'https://rochielgxaypmyjboirs.supabase.co',
  key: 'sb_publishable_cYau-CTXA-IBSj_LP9pBvg_L8olNOFT'
};

(function() {
  var hasSdk = typeof window.supabase !== 'undefined';
  var hasConfig = window.SupabaseConfig &&
    window.SupabaseConfig.url &&
    window.SupabaseConfig.key &&
    window.SupabaseConfig.url !== 'YOUR_SUPABASE_URL' &&
    window.SupabaseConfig.key !== 'YOUR_SUPABASE_PUBLISHABLE_KEY';

  window.SupabaseClient = hasSdk && hasConfig
    ? window.supabase.createClient(window.SupabaseConfig.url, window.SupabaseConfig.key)
    : null;
})();
