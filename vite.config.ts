import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env         = loadEnv(mode, '.', '');
  const buildTarget = process.env.VITE_BUILD_TARGET;
  const base        = (buildTarget === 'desktop' || buildTarget === 'mobile') ? './' : '/';

  // Read API key from EITHER the .env file OR the system environment variable.
  // This is critical for GitHub Actions where the key comes from a Secret,
  // not a .env file. Without this the Android build has no API key and
  // every Gemini call silently fails.
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  return {
    base,
    server: {
      port:         5000,
      host:         '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Cinematic Director', short_name: 'CD',
          start_url: '/', display: 'standalone',
          background_color: '#0f172a', theme_color: '#0f172a',
          icons: [
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        external: [
          '@capacitor/core',
          '@capacitor/android',
          '@capacitor/ios',
          '@capacitor-community/inappbrowser',
        ],
      },
    },
    define: {
      // Hardcode the API key into the bundle at build time.
      // Both variable names used across the codebase are covered.
      'process.env.API_KEY':        JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  };
});
