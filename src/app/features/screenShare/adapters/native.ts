import {Capacitor, registerPlugin} from "@capacitor/core"
import type {PluginListenerHandle} from "@capacitor/core"
import {fetchLivekitToken} from "@app/features/call"
import {
  ScreenShareDenied,
  errorCode,
  type IScreenShareAdapter,
  type ScreenShareContext,
} from "@app/features/screenShare/adapters/common"

type NativeScreenSharePlugin = {
  start: (options: {serverUrl: string; token: string}) => Promise<void>
  stop: () => Promise<void>
  addListener: (event: "screenShareStopped", handler: () => void) => Promise<PluginListenerHandle>
}

const ScreenSharePlugin = registerPlugin<NativeScreenSharePlugin>("ScreenShare")

/** The native side joins the room a second time and publishes the screen track from there. */
export class NativeScreenShare implements IScreenShareAdapter {
  isSupported() {
    return Capacitor.isPluginAvailable("ScreenShare")
  }

  async start({url, h}: ScreenShareContext) {
    const {server_url, participant_token} = await fetchLivekitToken(url, h)

    try {
      await ScreenSharePlugin.start({serverUrl: server_url, token: participant_token})
    } catch (error) {
      if (errorCode(error) === "cancelled") {
        return false
      }

      if (errorCode(error) === "denied") {
        throw new ScreenShareDenied("Screen recording is blocked in your device settings.")
      }

      throw error
    }

    return true
  }

  async stop() {
    await ScreenSharePlugin.stop()
  }

  onStopped(handler: () => void) {
    const listener = ScreenSharePlugin.addListener("screenShareStopped", handler)

    return () => {
      listener.then(l => l.remove())
    }
  }
}
