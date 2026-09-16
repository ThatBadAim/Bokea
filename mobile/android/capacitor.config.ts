import type { CapacitorConfig } from '@capacitor/cli';

const BACKGROUND = '#09090b';

const config: CapacitorConfig = {
  appId: 'com.bokea.app',
  appName: 'Bokeà',
  webDir: 'www',

  android: {
    backgroundColor: BACKGROUND,
    allowMixedContent: false
  },

  plugins: {
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover'
    },
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: BACKGROUND,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
      useDialog: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_bokea',
      iconColor: '#4A7C59'
    }
  }
};

export default config;
