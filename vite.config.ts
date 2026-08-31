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
        manifest: {
          name: 'DAVVERO System',
          short_name: 'DAVVERO',
          id: '/?v=davvero-pwa-v3',
          description: 'Sistema avançado de identidades, eventos acadêmicos, seminários e dioceses.',
          theme_color: '#0ea5e9',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
