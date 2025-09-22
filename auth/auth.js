// auth/auth.js
(function () {
  // Try CDNs first (fast when they work), then your local vendored copy.
  const SDK_SOURCES = [
    "https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.js",
    "https://unpkg.com/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.js",
    // Local fallback (always available once you vendor the file)
    "./auth/vendor/auth0-spa-js.production.js",
  ];

  let auth0Client = null;
  let sdkLoaded = false;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => resolve(url);
      s.onerror = () => reject(new Error("Failed to load: " + url));
      document.head.appendChild(s);
    });
  }

  async function loadSdkWithFallbacks() {
    if (sdkLoaded) return;
    let lastErr;
    for (const url of SDK_SOURCES) {
      try {
        await loadScript(url);
        if (typeof window.auth0 === "object" || typeof window.createAuth0Client === "function") {
          sdkLoaded = true;
          return;
        }
      } catch (e) {
        lastErr = e;
        // try next source
      }
    }
    throw lastErr || new Error("Auth0 SDK could not be loaded from any source.");
  }

  async function initAuth() {
    if (auth0Client) return auth0Client;
    await loadSdkWithFallbacks();

    // Supports either global "auth0" or "createAuth0Client"
    const createClient =
      (window.auth0 && window.auth0.createAuth0Client) || window.createAuth0Client;

    if (typeof createClient !== "function") {
      throw new Error("Auth0 SDK loaded but createAuth0Client is unavailable.");
    }

    auth0Client = await createClient({
    domain: window.__AUTH0_CONFIG__.domain,
    clientId: window.__AUTH0_CONFIG__.clientId,
    authorizationParams: {
        redirect_uri: window.__AUTH0_CONFIG__.redirectUri,
        scope: "openid profile email offline_access"
        // audience: window.__AUTH0_CONFIG__.audience || undefined,
    },
    useRefreshTokens: true,
    cacheLocation: "localstorage"   // <— was "memory"
    });

    return auth0Client;
  }

  async function login() {
    const client = await initAuth();
    await client.loginWithRedirect();
  }

  async function logout() {
    const client = await initAuth();
    await client.logout({
      logoutParams: {
        returnTo:
          window.__AUTH0_CONFIG__.publicLoginPage ||
          window.__AUTH0_CONFIG__.postLoginRedirect ||
          "./login.html",
      },
    });
  }

  async function isAuthenticated() {
    const client = await initAuth();
    return client.isAuthenticated();
  }

  async function getUser() {
    const client = await initAuth();
    return client.getUser();
  }

  async function getAccessToken(options = {}) {
    const client = await initAuth();
    return client.getAccessTokenSilently(options);
  }

  async function handleRedirectIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && params.has("state")) {
      const client = await initAuth();
      await client.handleRedirectCallback();
    }
  }

  // Expose API immediately
  window.Auth = {
    initAuth,
    login,
    logout,
    isAuthenticated,
    getUser,
    getAccessToken,
    handleRedirectIfNeeded,
  };
})();
