// auth/guard.js
(async () => {
  // Wait for SDK & client
  await Auth.initAuth();

  // If this page is meant to be protected, call `requirePageAuth()`
  async function requirePageAuth() {
    const authed = await Auth.isAuthenticated();
    if (!authed) {
      // Remember where the user wanted to go (dashboard, etc.)
      const ret = location.pathname + location.search + location.hash;
      sessionStorage.setItem('post_login_redirect', ret);
      location.replace('./login.html');
      return false;
    }
    return true;
  }

  // Expose to pages
  window.AuthGuard = { requirePageAuth };
})();
