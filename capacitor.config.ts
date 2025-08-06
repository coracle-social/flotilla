import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'social.flotilla',
  appName: 'Flotilla',
  webDir: 'build'
  server: {
    androidScheme: "https"
  },
  android: {
    adjustMarginsForEdgeToEdge: false,
  },
  plugins: {
    SplashScreen: {
      androidSplashResourceName: "splash"
    },
    Keyboard: {
      style: "DARK",
      resizeOnFullScreen: true,
    },
    Badge: {
      persist: true,
      autoClear: true
    },
  },
  // Use this for live reload https://capacitorjs.com/docs/guides/live-reload
  // server: {
  //   url: "http://192.168.1.115:1847",
  //   cleartext: true
  // },
};

export default config;
