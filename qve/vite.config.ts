import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

/**
 * WIN-227: Vite plugin to handle agent cancel requests directly in Node.js.
 *
 * The PHP built-in dev server is single-threaded — it can't process a cancel
 * POST while a streaming SSE request is in-flight. This plugin intercepts
 * cancelRequest.php and writes the cancel token file directly, matching the
 * same path format PHP uses: {tmpdir}/agent_cancel_{requestId}
 *
 * On production (Apache), concurrent requests work natively so the real
 * cancelRequest.php endpoint handles it.
 */
function agentCancelPlugin(): Plugin {
  return {
    name: 'agent-cancel',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes('cancelRequest.php') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { requestId } = JSON.parse(body);
              if (!requestId || typeof requestId !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Missing requestId' }));
                return;
              }
              const safe = requestId.replace(/[^a-zA-Z0-9_-]/g, '');
              const tokenPath = join(tmpdir(), `agent_cancel_${safe}`);
              writeFileSync(tokenPath, '', { flag: 'w' });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, cancelled: true }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  server: {
    proxy: {
      // Proxy API calls to PHP backend during development
      '/resources/php': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      // Proxy image requests to PHP backend
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    agentCancelPlugin(),
    sveltekit(),
    SvelteKitPWA({
      srcDir: 'src',
      mode: 'development',
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Qvé Wine Collection',
        short_name: 'Qvé',
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
            // WIN-265: Only cache read-only GET endpoints, not mutation endpoints
            urlPattern: /\/resources\/php\/get\w+\.php/i,
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
