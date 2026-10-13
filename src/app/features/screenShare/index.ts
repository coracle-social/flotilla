import {Capacitor} from "@capacitor/core"
import {ElectronScreenShare} from "@app/features/screenShare/adapters/electron"
import {NativeScreenShare} from "@app/features/screenShare/adapters/native"
import {WebScreenShare} from "@app/features/screenShare/adapters/web"
import type {
  IScreenShareAdapter,
  ScreenShareContext,
} from "@app/features/screenShare/adapters/common"

export {ScreenShareDenied} from "@app/features/screenShare/adapters/common"
export type {ScreenShareContext, ScreenShareSource} from "@app/features/screenShare/adapters/common"

export class ScreenShare {
  static _adapter: IScreenShareAdapter | undefined

  static _getAdapter() {
    if (!ScreenShare._adapter) {
      if (Capacitor.getPlatform() === "electron") {
        ScreenShare._adapter = new ElectronScreenShare()
      } else if (Capacitor.isNativePlatform()) {
        ScreenShare._adapter = new NativeScreenShare()
      } else {
        ScreenShare._adapter = new WebScreenShare()
      }
    }

    return ScreenShare._adapter
  }

  static isSupported() {
    return ScreenShare._getAdapter().isSupported()
  }

  /** Resolves false when the user dismissed the picker, throws ScreenShareDenied when blocked. */
  static start(context: ScreenShareContext) {
    return ScreenShare._getAdapter().start(context)
  }

  static stop(context: ScreenShareContext) {
    return ScreenShare._getAdapter().stop(context)
  }

  /** Fires when the share ended outside the app, from a system control or a browser prompt. */
  static onStopped(handler: () => void) {
    return ScreenShare._getAdapter().onStopped(handler)
  }
}
