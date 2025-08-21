import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import viteCompression from "vite-plugin-compression";
import fs from "fs";
import path from "path";

// Try to enable HTTPS if cert files are present
const CERT_PATH = "/etc/letsencrypt/live/test.lapiccolaitalia.cl/fullchain.pem";
const KEY_PATH = "/etc/letsencrypt/live/test.lapiccolaitalia.cl/privkey.pem";
const hasHttpsCerts = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);
const httpsConfig = hasHttpsCerts
  ? {
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH),
    }
  : false;

const LOWMEM = process.env.LOWMEM_BUILD === '1';

export default defineConfig({
  base: '/',
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    drop: ['console', 'debugger'],
  },
  optimizeDeps: {
    exclude: ['analytics.js', 'ajs-destination', 'lucide-react', 'react-icons', 'firebase'],
    include: ['void-elements', 'firebase/app', 'firebase/messaging'],
    esbuildOptions: {
      plugins: [
        {
          name: 'react-icons-mjs-fix',
          setup(build) {
            // Fix relative import in react-icons/* packages: '../lib/index.mjs' -> '../lib/index.js'
            build.onResolve({ filter: /\.\.\/lib\/index\.mjs$/ }, (args) => {
              if (args.importer && args.importer.includes(`${path.sep}node_modules${path.sep}react-icons${path.sep}`)) {
                const resolved = path.resolve(path.dirname(args.importer), '../lib/index.js');
                return { path: resolved };
              }
              return null;
            });
          },
        },
      ],
    },
  },

  plugins: [
    {
      name: 'react-icons-rewrite-mjs',
      enforce: 'pre',
      transform(code, id) {
        if (
          id.includes(`${path.sep}node_modules${path.sep}react-icons${path.sep}`) &&
          id.endsWith(`${path.sep}index.mjs`)
        ) {
          return {
            code: code.replace('../lib/index.mjs', '../lib/index.js'),
            map: null,
          };
        }
        return null;
      },
    },
    react(),
    // Desactiva polyfills pesados en LOWMEM para reducir tamaño/transformaciones
    ...(LOWMEM
      ? []
      : [
          nodePolyfills({
            buffer: true,
            process: true,
            global: true,
            crypto: true,
            stream: true,
            events: true,
          }),
        ]),
    // Desactiva compresión en builds de baja memoria
    ...(LOWMEM
      ? []
      : [
          viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 10240, // Solo comprime archivos mayores a 10kb
            deleteOriginFile: false, // Conserva los archivos originales
          }),
        ]),
  ],
  resolve: {
    alias: {
      // react-icons@5.5.0 ESM build references ../lib/index.mjs, but the package ships index.js
      'react-icons/lib/index.mjs': 'react-icons/lib/index.js',
    },
    // Ensure React is de-duplicated to prevent multiple copies (avoids invalid hook calls)
    dedupe: ['react', 'react-dom'],
  },

  server: {
    port: 5173,
    host: true,
    strictPort: false,
    cors: false,
    open: false,
    https: httpsConfig,
    // Proxy para desarrollo: Vite (dex2.vanellix.com:5173) -> API real en hub.vanellix.com
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: false,
  },

  build: {
    outDir: "dist",
    assetsDir: 'assets',
    sourcemap: false,
    modulePreload: false,
    cssCodeSplit: LOWMEM ? false : false,
    cssMinify: LOWMEM ? false : true,
    target: 'es2020',
    minify: LOWMEM ? false : 'esbuild',
    terserOptions: undefined,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500, // Sube el límite del warning
    rollupOptions: {
      // Mantén fuera del bundle los paquetes de WalletConnect/Reown siempre
      external: [/^@walletconnect\//, /^@reown\//],
      output: { inlineDynamicImports: true },
      treeshake: false,
    },
  },
});