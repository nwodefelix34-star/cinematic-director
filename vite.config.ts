import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env         = loadEnv(mode, '.', '');
  const buildTarget = process.env.VITE_BUILD_TARGET;
  const base        = (buildTarget === 'desktop' || buildTarget === 'mobile') ? './' : '/';

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
        // Capacitor packages are ALWAYS external — they are never bundled.
        // On web/desktop: they don't exist and are not needed.
        // On Android/iOS: they are provided by the native Capacitor shell,
        // not through the npm bundle. The native layer injects them at runtime.
        external: [
          '@capacitor/core',
          '@capacitor/android',
          '@capacitor/ios',
          '@capacitor-community/inappbrowser',
        ],
      },
    },
    define: {
      'process.env.API_KEY':        JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  };
});
