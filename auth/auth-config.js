// auth/auth-config.js
(() => {
  const origin = window.location.origin;            // e.g., http://localhost:3000 or https://dr-afif.github.io
  const onPages = origin.includes('github.io');
  const base = onPages ? '/hsaas-oncallroster' : ''; // repo base path on GitHub Pages

  window.__AUTH0_CONFIG__ = {
    domain: 'dev-tsj44nqdrmqmxn5o.us.auth0.com',   // e.g., my-tenant.us.auth0.com
    clientId: 'PcbKjeIAa0XoEWYt4M4nGKACt20raBZU',
    audience: '', // optional if you have an API
    redirectUri: `${origin}${base}/callback.html`,
    postLoginRedirect: `${origin}${base}/index.html`, // default after successful login
    publicLoginPage: `${origin}${base}/login.html`    // where to return after logout
  };
})();
