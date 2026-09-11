import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  // `vite preview` (used as the production start command on Railway) rejects unrecognized
  // Host headers by default - the deployed domain isn't known ahead of time, so allow any.
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
