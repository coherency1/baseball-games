import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/baseball/statpad/',
  plugins: [react()],
  build: {
    outDir: '../../dist/statpad',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
  },

  server: {
    // Layer A caching: set long-lived Cache-Control headers for large static assets
    // so normal browser refreshes (F5) return 304 Not Modified — zero bytes downloaded.
    // Only hard refresh (Ctrl+Shift+R) bypasses this; Layer B (sessionStorage in
    // useLahmanData) handles that case within the same browser session.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const isCacheable =
          url.startsWith('/lahman-folder/') ||
          url === '/headshots.json'         ||
          url === '/statpad_data.json'      ||
          /\.(png|jpg|svg|webp)(\?.*)?$/.test(url);

        if (isCacheable) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }
        next();
      });
    },
  },
})
