// auth/auth.js - Supabase version
(function () {
  let supabaseClient = null;

  async function getSupabase() {
    if (supabaseClient) return supabaseClient;

    // Check if SDK is loaded
    if (!window.supabase) {
      // Wait briefly if it's still loading
      await new Promise(r => setTimeout(r, 100));
      if (!window.supabase) throw new Error("Supabase SDK not found. Ensure script tag is present.");
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase config missing in APP_CONFIG.");
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  async function initAuth() {
    const sb = await getSupabase();
    // Supabase handles the session automatically via localStorage
    return sb;
  }

  async function login() {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/callback.html'),
        queryParams: {
          hd: 'upm.edu.my' // Optional: Hint to only allow UPM accounts if configured in Google
        }
      }
    });
    if (error) console.error("Login error:", error.message);
  }

  async function logout() {
    const sb = await getSupabase();
    await sb.auth.signOut();
    location.replace('./login.html');
  }

  async function isAuthenticated() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return !!session;
  }

  async function getUser() {
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  async function handleRedirectIfNeeded() {
    const sb = await getSupabase();
    // Supabase JS handles the hash/code exchange automatically on initialization
    // but we can wait for the session to be sure.
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    return session;
  }

  // Expose API
  window.Auth = {
    initAuth,
    login,
    logout,
    isAuthenticated,
    getUser,
    handleRedirectIfNeeded,
  };
})();
