import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env         = loadEnv(mode, '.', '');
  const buildTarget = process.env.VITE_BUILD_TARGET;
  const base        = (buildTarget === 'desktop' || buildTarget === 'mobile') ? './' : '/';

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
        // Always externalize Capacitor packages across ALL builds.
        // We no longer import them in the code — instead we access them
        // via window.Capacitor.Plugins at runtime on Android/iOS.
        // This means Rollup never tries to bundle them and never fails.
        // Externalize native-only Capacitor packages that can't be bundled.
        // @capacitor/browser is intentionally NOT here — it must be bundled
        // so the plugin JS is available inside the Android WebView.
        external: [
          '@capacitor/core',
          '@capacitor/android',
          '@capacitor/ios',
          '@capacitor-community/inappbrowser',
        ],
      },
    },
    define: {
      'import.meta.env.VITE_API_KEY':   JSON.stringify(apiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'process.env.API_KEY':            JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY':     JSON.stringify(apiKey),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  };
});
