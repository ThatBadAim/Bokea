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
      resize: 'body',
      style: 'dark'
    }
  }
};

export default config;
