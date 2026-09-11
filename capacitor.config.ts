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
    // Use this for live reload https://capacitorjs.com/docs/guides/live-reload
    // url: "http://192.168.1.17:1847",
    // cleartext: true,
  },
}

if (
  process.argv.includes("run") &&
  process.argv.includes("@capawesome/capacitor-electron") &&
  process.env.FLOTILLA_DESKTOP_DEV_URL
) {
  config.server = {...config.server, url: process.env.FLOTILLA_DESKTOP_DEV_URL}
}

export default config
