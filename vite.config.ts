import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || `local-${Date.now()}`
    ),
  },
  server: {
    proxy: {
      // Proxies /api/off-search → search.openfoodfacts.org in dev (bypasses CORS)
      '/api/off-search': {
        target: 'https://search.openfoodfacts.org',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/off-search', '/search'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Freshli - Your Food, Seen Clearly',
        short_name: 'Freshli',
        description: 'Track your food, reduce waste, get notified before items expire',
        theme_color: '#073d35',
        background_color: '#f7f6ef',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
