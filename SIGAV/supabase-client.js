// Cria o cliente Supabase global (window.sb).
// Requer, antes deste arquivo: supabase-js (UMD) e supabase-config.js.
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('supabase-js não carregou.');
    return;
  }
  var cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.publishableKey) {
    console.error('supabase-config.js ausente. Rode: node scripts/generate-config.mjs');
    return;
  }
  window.sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
