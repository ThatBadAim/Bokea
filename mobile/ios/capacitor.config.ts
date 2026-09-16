import type { CapacitorConfig } from '@capacitor/cli';

const BACKGROUND = '#09090b';

const config: CapacitorConfig = {
  appId: 'com.bokea.app',
  appName: 'Bokeà',
  webDir: 'www',

  ios: {
    backgroundColor: BACKGROUND,
    contentInset: 'never',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile'
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: BACKGROUND,
      showSpinner: false,
      useDialog: false
    },
    StatusBar: {
      style: 'DARK'
    },
    LocalNotifications: {
      presentationOptions: ['banner', 'list', 'sound', 'badge']
    },
    Keyboard: {
      // Lower case: compared against "body" exactly.
      resize: 'body',
      // Upper case: compared against "DARK" exactly. This path happens to be
      // upper cased natively first, so either would work here - but the
      // setStyle call the bridge makes as the theme changes is not, and a
      // lower-case value there fails silently. Written the same way in both
      // places so neither looks like the odd one out.
      style: 'DARK'
    }
  }
};

export default config;
