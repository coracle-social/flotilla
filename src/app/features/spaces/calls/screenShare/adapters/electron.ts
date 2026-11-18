import {registerPlugin} from "@capacitor/core"
import {PLATFORM_NAME} from "@app/core/env"
import {WebScreenShare} from "@app/features/spaces/calls/screenShare/adapters/web"
import {
  ScreenShareDenied,
  errorCode,
  type PickSource,
  type ScreenShareContext,
  type ScreenShareSource,
} from "@app/features/spaces/calls/screenShare/adapters/common"

type DesktopScreenSharePlugin = {
  getSources: () => Promise<{requiresPicker: boolean; sources: ScreenShareSource[]}>
  select: (options: {id: string}) => Promise<void>
}

const DesktopScreenShare = registerPlugin<DesktopScreenSharePlugin>("DesktopScreenShare")

export class ElectronScreenShare extends WebScreenShare {
  isSupported() {
    return true
  }

  async start(context: ScreenShareContext, pickSource: PickSource) {
    let sources: ScreenShareSource[]
    let requiresPicker: boolean

    try {
      ;({requiresPicker, sources} = await DesktopScreenShare.getSources())
    } catch (error) {
      if (errorCode(error) === "screen-access-denied") {
        throw new ScreenShareDenied(
          `Screen recording is blocked. Allow ${PLATFORM_NAME} to record your screen in System Settings.`,
        )
      }
      throw error
    }

    // Wayland runs its own picker in the portal, so there is nothing to choose here.
    if (requiresPicker) {
      const source = await pickSource(sources)

      if (!source) {
        return false
      }

      await DesktopScreenShare.select({id: source.id})
    }

    return super.start(context, pickSource)
  }
}
