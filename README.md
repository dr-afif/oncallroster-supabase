# HSAAS On-Call Doctor Dashboard

A high-performance, mobile-optimized Progressive Web App (PWA) for managing and viewing hospital on-call rosters. Designed for speed, reliability, and ease of migration to institutional infrastructure.

## 🚀 Key Features
- **Instant Load:** Uses LocalStorage for immediate data rendering.
- **Full Offline Support:** Works without internet connection once synced.
- **Date Navigation:** Integrated calendar picker and daily flip controls.
- **Smart Data Trimming:** Automatically keeps only recent history and current month for maximum performance.
- **High-Efficiency Search:** Debounced and pre-cached search logic for smooth interaction.

---

## 🏛 Migration & Self-Hosting Guide

This application is designed to be "Server-Agnostic" and can be hosted entirely within an internal institutional network (e.g., University or Hospital server) to ensure privacy and security.

### 1. Hosting the Web App
The project is built with vanilla HTML/JS/CSS. It can be served by any standard web server:
- Apache / Nginx / IIS
- Node.js (serve)

**Production Note:** Ensure the app is served via **HTTPS** for Service Worker (offline mode) and PWA features to function correctly.

### 2. Centralized Configuration (`config.js`)
All environment-specific variables are located in `config.js`. To migrate:
1. Move the project folder to the hospital server.
2. Update `config.js` with institutional endpoints:
   - `SNAPSHOT_URL`: Set to `'./snapshot.json'` for local hosting.
   - `BACKEND_URL`: Point to your internal Sheets proxy.
   - `DRIVE_API_KEY`: Hospital-specific restricted Google API Key.

### 3. Internal Data Updates (`internal_updater.js`)
To avoid dependency on GitHub Actions or public cloud sync:
1. Install Node.js on your server.
2. Schedule a "Cron Job" or Task to run `internal_updater.js` periodically (e.g., every hour).
   ```bash
   node internal_updater.js
   ```
3. This script fetches fresh data from the Google Sheets proxy and saves it as a local `snapshot.json`.

### 4. Authentication Migration
The current setup uses Auth0. For institutional migration:
1. Locate the authentication logic in `auth/auth.js`.
2. Replace it with your institutional Single Sign-On (SSO) provider (Azure AD, Okta, LDAP, etc.).
3. The app is structure-neutral, so you only need to ensure the "Guard" logic in HTML files calls your new auth script.

---

## 🛠 Development Commands
- **Start Local Server:** `npx serve .`
- **Manual Data Sync:** `node internal_updater.js`
- **Trim Snapshot:** Local data is automatically trimmed by the updater script to keep the app lean.

---

**Author:** Dr. Muhammad Afif Abdullah
**Version:** 2.0 (Migration-Ready)
