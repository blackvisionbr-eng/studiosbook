import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Stable entry files prevent an older HTML document from requesting a
    // removed hashed app shell after a Hosting release.
    emptyOutDir: false,
    modulePreload: false,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "admin.html"),
        authAction: path.resolve(__dirname, "auth-action.html"),
        booking: path.resolve(__dirname, "booking.html"),
        receivables: path.resolve(__dirname, "recebimentos.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const names = assetInfo.names || (assetInfo.name ? [assetInfo.name] : []);
          return names.some((name) => name.endsWith(".css"))
            ? "assets/index.css"
            : "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
