import type {CapacitorConfig} from "@capacitor/cli"
import {loadEnv} from "vite"

const config: CapacitorConfig = {
  appId: "social.flotilla",
  appName: loadEnv(process.env.NODE_ENV || "production", process.cwd(), "VITE_").VITE_PLATFORM_NAME,
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
