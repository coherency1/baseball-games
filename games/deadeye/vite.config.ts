import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/baseball/deadeye/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../../dist/deadeye',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          search: ['fuse.js'],
        },
      },
    },
  },
});
