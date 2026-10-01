import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { contentPlugin } from './src/content/vite-plugin.ts';

// GitHub Pages serves the site under /<repo-name>/, so the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    contentPlugin(import.meta.dirname),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Door to Decision',
        short_name: 'Door to Decision',
        description: 'Decision-based emergency medicine cases. For education only.',
        theme_color: '#f6f3ea',
        background_color: '#f6f3ea',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Illustrations (.webp, ~1 MB a case) are NOT in the install download: they are cached when a
        // case is played or saved for offline (src/lib/offline.ts uses the same cache name).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'd2d-art',
              expiration: { maxEntries: 1000, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'] },
});
