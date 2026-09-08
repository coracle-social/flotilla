import {writable} from "svelte/store"
import {Capacitor, registerPlugin} from "@capacitor/core"
import type {PluginListenerHandle} from "@capacitor/core"
import {noop} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {app, relays} from "@app/core"
import {navigate, pushModal} from "@app/modal"
import {makeSpaceChatPath} from "@app/routes"
import {pushToast} from "@app/toast"
import ShareDialog from "@app/components/Share.svelte"
import ShareEvent from "@app/components/ShareEvent.svelte"

export type Share =
  | {type: "event"; value: TrustedEvent}
  | {type: "text"; value: string}
  | {type: "file"; value: File}

export const pendingShare = writable<Maybe<Share>>(undefined)

// Set pendingShare after navigating so the current view doesn't pop it
export const shareTo = async (
  path: string,
  share: Share,
  options: {replaceState?: boolean} = {},
) => {
  await navigate(path, options)

  pendingShare.set(share)
}

export const shareEvent = (url: string, noun: string, event: TrustedEvent) => {
  if (relays.get().get(url)?.hasNip(29)) {
    pushModal(ShareEvent, {url, noun, event})
  } else {
    shareTo(makeSpaceChatPath(url), {type: "event", value: event})
  }
}

const openShareDialog = (share: Share) => {
  if (app.get().user?.pubkey) {
    pushModal(ShareDialog, {share})
  }
}

export const shareText = (value: string) => openShareDialog({type: "text", value})

type NativeShare = {
  text?: string
  path?: string
  name?: string
  type?: string
}

// Shared media is copied somewhere capacitor's file server can reach, since neither an android
// content uri nor an ios app group url means anything to the web view.
export const shareFromNative = async ({
  text,
  path,
  name = "",
  type: mimeType = "",
}: NativeShare) => {
  if (text) {
    shareText(text)
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
