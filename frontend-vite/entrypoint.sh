#!/bin/sh

# Sustituye todas las variables necesarias en nginx.conf
envsubst '$DOMAIN $STATIC_ROOT $BACKEND_HOST $BACKEND_PORT' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf

# Genera /usr/share/nginx/html/env.js con todas las variables VITE_*
cat <<EOF > /usr/share/nginx/html/env.js
window.env = {
  VITE_RPC_URL: "${VITE_RPC_URL}",
  VITE_API_URL: "${VITE_API_URL}",
  VITE_BLOCK_EXPLORER: "${VITE_BLOCK_EXPLORER}",
  VITE_PRIVY_APP_ID: "${VITE_PRIVY_APP_ID}",
  VITE_MODE: "${VITE_MODE}",
  VITE_CHAIN_ID: "${VITE_CHAIN_ID}",
  VITE_GOOGLE_MAPS_API_KEY: "${VITE_GOOGLE_MAPS_API_KEY}",
  VITE_COMPANY_ID: "${VITE_COMPANY_ID}",
  VITE_GOOGLE_MAP_ID: "${VITE_GOOGLE_MAP_ID}",
  VITE_VAPID_KEY: "${VITE_VAPID_KEY}",
  VITE_DRIP_ACCOUNT_ID: "${VITE_DRIP_ACCOUNT_ID}",
};
EOF

nginx -g 'daemon off;'