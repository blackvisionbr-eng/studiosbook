import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "admin.html"),
        authAction: path.resolve(__dirname, "auth-action.html"),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
