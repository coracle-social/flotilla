import {registerPlugin} from "@capacitor/core"
import ScreenSharePicker from "@app/components/ScreenSharePicker.svelte"
import {PLATFORM_NAME} from "@app/core/env"
import {pushModal} from "@app/ui/modal"
import {WebScreenShare} from "@app/features/screenShare/adapters/web"
import {
  ScreenShareDenied,
  errorCode,
  type ScreenShareContext,
  type ScreenShareSource,
} from "@app/features/screenShare/adapters/common"

type DesktopScreenSharePlugin = {
  getSources: () => Promise<{requiresPicker: boolean; sources: ScreenShareSource[]}>
  select: (options: {id: string}) => Promise<void>
}

const DesktopScreenShare = registerPlugin<DesktopScreenSharePlugin>("DesktopScreenShare")

const selectSource = (sources: ScreenShareSource[]) =>
  new Promise<ScreenShareSource | undefined>(resolve => {
    pushModal(ScreenSharePicker, {sources, onSelect: resolve}, {size: "large"})
  })

export class ElectronScreenShare extends WebScreenShare {
  isSupported() {
    return true
  }

  async start(context: ScreenShareContext) {
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
      const source = await selectSource(sources)

      if (!source) {
        return false
      }

      await DesktopScreenShare.select({id: source.id})
    }

    return super.start(context)
  }
}
