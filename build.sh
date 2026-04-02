#!/bin/bash
# For Cloudflare Pages deployment
# This script generates the app-config.js from Cloudflare Environment Variables
printf 'window.APP_CONFIG = {\n  SUPABASE_URL: "%s",\n  SUPABASE_ANON_KEY: "%s",\n  REFRESH_INTERVAL: 0\n};\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > app-config.js
echo "✅ app-config.js created successfully for Cloudflare Pages."
