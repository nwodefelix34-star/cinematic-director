import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env         = loadEnv(mode, '.', '');
  const buildTarget = process.env.VITE_BUILD_TARGET;
  const base        = (buildTarget === 'desktop' || buildTarget === 'mobile') ? './' : '/';

  // Read API key from any of the possible sources:
  // - process.env.GEMINI_API_KEY  → GitHub Actions secret
  // - process.env.VITE_API_KEY    → if someone named it that
  // - env.VITE_API_KEY            → .env file locally
  // - env.GEMINI_API_KEY          → .env file alternate name
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_API_KEY   ||
    env.VITE_API_KEY            ||
    env.GEMINI_API_KEY          ||
    '';

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
      // Expose the key under EVERY name the codebase might use
      'import.meta.env.VITE_API_KEY':    JSON.stringify(apiKey),
      'import.meta.env.GEMINI_API_KEY':  JSON.stringify(apiKey),
      'process.env.API_KEY':             JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY':      JSON.stringify(apiKey),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  };
});
