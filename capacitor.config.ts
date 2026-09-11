import type {CapacitorConfig} from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "social.flotilla",
  appName: "Flotilla",
  webDir: "build",
  ios: {
    scheme: "Flotilla Chat",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: "css",
    },
    SplashScreen: {
      androidSplashResourceName: "splash",
    },
    Keyboard: {
      style: "DARK",
    },
    Badge: {
      persist: true,
      autoClear: true,
    },
  },
  server: {
    url: process.env.FLOTILLA_DESKTOP_DEV_URL,
  },
}

export default config
