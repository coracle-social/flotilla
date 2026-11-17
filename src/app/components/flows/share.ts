import {Capacitor, registerPlugin} from "@capacitor/core"
import type {PluginListenerHandle} from "@capacitor/core"
import {noop} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import {relays} from "@app/core/plugins"
import {pushModal} from "@app/navigation/dialogs"
import * as pages from "@app/navigation/pages"
import {pushToast} from "@app/navigation/toast"
import {shareTo} from "@app/features/share"
import type {Share} from "@app/features/share"
import ShareDialog from "@app/components/Share.svelte"
import ShareEvent from "@app/components/ShareEvent.svelte"

const openShareDialog = (share: Share) => {
  if (app.get().user?.pubkey) {
    pushModal(ShareDialog, {share})
  }
}

export const shareEvent = (url: Maybe<string>, noun: string, event: TrustedEvent) => {
  if (url) {
    if (relays.get().get(url)?.hasNip(29)) {
      pushModal(ShareEvent, {url, noun, event})
    } else {
      shareTo(pages.spaceChat.path({url}), {type: "event", value: event})
    }
  } else {
    openShareDialog({type: "event", value: event})
  }
}

type NativeShare = {
  text?: string
  path?: string
  name?: string
  type?: string
}

// Neither an android content uri nor an ios app group url means anything to the web view.
export const shareFromNative = async ({
  text,
  path,
  name = "",
  type: mimeType = "",
}: NativeShare) => {
  if (text) {
    openShareDialog({type: "text", value: text})
  } else if (path) {
    try {
      const response = await fetch(Capacitor.convertFileSrc(path))

      if (!response.ok) {
        throw new Error(`Failed to read ${path} (${response.status})`)
      }

      const value = new File([await response.blob()], name, {type: mimeType})

      openShareDialog({type: "file", value})
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Something went wrong reading the shared file."})
    }
  }
}

type ShareIntentPlugin = {
  addListener(
    eventName: "shareReceived",
    listener: (share: NativeShare) => void,
  ): Promise<PluginListenerHandle>
}

const ShareIntent = registerPlugin<ShareIntentPlugin>("ShareIntent")

export const setupShareIntents = () => {
  if (Capacitor.getPlatform() === "android") {
    const listener = ShareIntent.addListener("shareReceived", shareFromNative)

    return () => {
      listener.then(handle => handle.remove())
    }
  }

  return noop
}
