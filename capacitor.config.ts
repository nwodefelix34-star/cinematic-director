import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.cinematicdirector.app',
  appName: 'Cinematic Director',
  webDir:  'dist',

  server: {
    androidScheme: 'https',
  },

  android: {
    allowMixedContent: true,
  },

  // cordova-plugin-inappbrowser config
  // Opens URLs in a true embedded WebView inside the app.
  // This is what makes downloads catchable and prevents Chrome from opening.
  cordova: {
    preferences: {
      // Allow the WebView to open any URL (needed for ImageFX, Hunyuan etc.)
      AllowNavigation: '*',
      // Keep cookies across sessions so user stays logged in
      InAppBrowserStorageCookies: 'true',
    },
  },

  plugins: {
    Browser: {},
  },
};

export default config;
