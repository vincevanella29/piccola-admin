import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import viteCompression from "vite-plugin-compression";
import fs from "fs";
import path from "path";

export default defineConfig({
  base: '/',
  optimizeDeps: {
    exclude: ["analytics.js", "ajs-destination"],
  },

  plugins: [
    react(),
    nodePolyfills({
      buffer: true,
      process: true,
      global: true,
      crypto: true,
      stream: true,
      events: true,
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Solo comprime archivos mayores a 10kb
      deleteOriginFile: false, // Conserva los archivos originales
    }),
  ],

  server: {
    port: 5173,
    host: true,
    strictPort: false,
    cors: false,
    open: false,
    ...(process.env.MODE === 'DEV' ? {
      https: {
        ssl_certificate: fs.readFileSync("/etc/letsencrypt/live/testing.lapiccolaitalia.cl/fullchain.pem"),
        ssl_certificate_key: fs.readFileSync("/etc/letsencrypt/live/testing.lapiccolaitalia.cl/privkey.pem"),
      },
    } : {}),
    // Proxy para desarrollo: Vite (dex2.vanellix.com:5173) -> API real en hub.vanellix.com
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    hmr: false,
  },

  build: {
    outDir: "dist",
    assetsDir: 'assets',
    cssCodeSplit: true,
    minify: 'esbuild', // Usa 'terser' si quieres aún más compresión
    chunkSizeWarningLimit: 1500, // Sube el límite del warning
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa bundles grandes para mejor performance
          react: ['react', 'react-dom'],
          ethers: ['ethers'],
          // Agrega aquí más librerías grandes si quieres:
          // ui: ['framer-motion', 'lucide-react', 'react-icons'],
        },
      },
    },
  },
});