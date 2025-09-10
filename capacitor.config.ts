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
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: true,
      iosKeychainPrefix: 'flotilla-sqlite',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle : "Biometric login for capacitor sqlite"
      },
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth : false,
        biometricTitle : "Biometric login for capacitor sqlite",
        biometricSubTitle : "Log in using your biometric"
      },
    }
  },
  // Use this for live reload https://capacitorjs.com/docs/guides/live-reload
  // server: {
  //   url: "http://192.168.1.115:1847",
  //   cleartext: true
  // },
};

export default config;
