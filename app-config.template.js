window.APP_CONFIG = {
  SUPABASE_URL: "{{SUPABASE_URL}}",
  SUPABASE_ANON_KEY: "{{SUPABASE_ANON_KEY}}",
  REFRESH_INTERVAL: 0
};

// Centralized Version Control
window.APP_VERSION = "2.1.0"; // Bumped to 2.1.0 for the Header Redesign & Navigation features

document.addEventListener("DOMContentLoaded", () => {
  const versionEls = document.querySelectorAll('#app-version-display');
  versionEls.forEach(el => el.textContent = `Version ${window.APP_VERSION}`);
});
