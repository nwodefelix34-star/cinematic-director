import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env         = loadEnv(mode, '.', '');
  const buildTarget = process.env.VITE_BUILD_TARGET; // 'desktop' | 'mobile' | undefined
  const isMobile    = buildTarget === 'mobile';
  const base        = (buildTarget === 'desktop' || isMobile) ? './' : '/';

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
        // ── CRITICAL ──────────────────────────────────────────────────
        // On MOBILE builds: do NOT externalize Capacitor packages.
        // They must be bundled into the JS so the Android WebView can
        // load them and bridge to native code (InAppBrowser etc.)
        //
        // On WEB / DESKTOP builds: externalize them — they don't exist
        // in those environments and would cause build errors.
        // ──────────────────────────────────────────────────────────────
        external: isMobile ? [] : [
          '@capacitor/core',
          '@capacitor/android',
          '@capacitor/ios',
          '@capacitor-community/inappbrowser',
        ],
      },
    },
    define: {
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
