import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json,webmanifest}'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB limit for large assets
        },
        manifest: {
          name: 'DAVVERO System',
          short_name: 'DAVVERO',
          id: '/?v=davvero-pwa-v3',
          description: 'Sistema avançado de identidades, eventos acadêmicos, seminários e dioceses.',
          theme_color: '#0ea5e9',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          handle_links: 'preferred',
          icons: [
            {
              src: '/icon-192.png?v=3',
              type: 'image/png',
              sizes: '192x192',
              purpose: 'any'
            },
            {
              src: '/icon-512.png?v=3',
              type: 'image/png',
              sizes: '512x512',
              purpose: 'any'
            },
            {
              src: '/icon-maskable-192.png?v=3',
              type: 'image/png',
              sizes: '192x192',
              purpose: 'maskable'
            },
            {
              src: '/icon-maskable-512.png?v=3',
              type: 'image/png',
              sizes: '512x512',
              purpose: 'maskable'
            },
            {
              src: '/apple-touch-icon.png?v=3',
              type: 'image/png',
              sizes: '180x180',
              purpose: 'any'
            },
            {
              src: '/icon.svg?v=3',
              type: 'image/svg+xml',
              sizes: '512x512',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    define: {
      // API Keys moved to backend
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'motion/react',
        'lucide-react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'firebase/messaging',
        'date-fns',
        'canvas-confetti',
        'clsx',
        'tailwind-merge',
        'qrcode.react',
        'react-easy-crop',
        'recharts',
        'html2canvas',
        'html-to-image',
        'html5-qrcode',
        'jspdf',
        'jspdf-autotable',
        'jszip',
        'xlsx',
      ],
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('xlsx') || id.includes('jszip') || id.includes('html2canvas') || id.includes('html-to-image')) {
                return 'vendor-export';
              }
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
