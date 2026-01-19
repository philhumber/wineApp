import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Proxy API calls to PHP backend during development
      '/resources/php': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      srcDir: 'src',
      mode: 'development',
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Qve Wine Collection',
        short_name: 'Qve',
        description: 'Personal wine collection management',
        theme_color: '#FAF9F7',
        background_color: '#FAF9F7',
        display: 'standalone',
        start_url: '/qve/',
        scope: '/qve/',
        icons: [
          {
            src: '/qve/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/qve/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/qve/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /\/resources\/php\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
        navigateFallback: '/qve/'
      }
    })
  ]
});
