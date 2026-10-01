import type {IScreenShareAdapter, ScreenShareContext} from "@app/screenShare/adapters/common"

// The browser reports a dismissed picker and a denied permission the same way.
const isCancellation = (error: unknown) =>
  error instanceof Error && ["AbortError", "NotAllowedError"].includes(error.name)

export class WebScreenShare implements IScreenShareAdapter {
  isSupported() {
    return Boolean(navigator.mediaDevices?.getDisplayMedia)
  }

  async start({participant}: ScreenShareContext) {
    try {
      await participant.setScreenShareEnabled(true)
    } catch (error) {
      if (isCancellation(error)) {
        return false
      }
      throw error
    }

    return true
  }

  async stop({participant}: ScreenShareContext) {
    await participant.setScreenShareEnabled(false)
  }

  onStopped() {
    return () => {}
  }
}
