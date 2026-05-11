import { CapacitorConfig } from '@capacitor/cli';

// ═══════════════════════════════════════════════════════════════
// CAPACITOR CONFIG — Android & iOS
//
// Android: Build and install the APK yourself using Android
//   Studio (free). No store account needed for personal use.
//
// iOS: The Capacitor code is fully ready and will work when
//   you are ready. Building for iPhone requires:
//     - A Mac computer
//     - Apple Developer account ($99/year)
//   When you go public on the App Store you will need both.
//   For now just build Android.
// ═══════════════════════════════════════════════════════════════

const config: CapacitorConfig = {
  appId:   'com.cinematicdirector.app',
  appName: 'Cinematic Director',
  webDir:  'dist',        // Vite build output folder

  server: {
    androidScheme: 'https',  // required so Android WebView handles assets correctly
  },

  android: {
    allowMixedContent: true, // lets the WebView load external sites (ImageFX, Hunyuan)
  },

  plugins: {
    // InAppBrowser opens a real browser panel inside the app.
    // It keeps cookies per URL so the user stays logged in.
    InAppBrowser: {},
  },
};

export default config;
