import {noop} from "@welshman/lib"
import {Capacitor, registerPlugin} from "@capacitor/core"
import type {PluginListenerHandle} from "@capacitor/core"
import {downloadBlob} from "@lib/html"
import {pushToast} from "@app/features/toast"

type NativeDownload = {url: string; name: string; type: string}

type WebViewDownloadPlugin = {
  addListener(
    eventName: "downloadRequested",
    listener: (download: NativeDownload) => void,
  ): Promise<PluginListenerHandle>
}

const WebViewDownload = registerPlugin<WebViewDownloadPlugin>("WebViewDownload")

const downloadFromWebView = async ({url, name}: NativeDownload) => {
  try {
    // Decrypted media is a blob url, which only this web view can read
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Download failed (HTTP ${response.status})`)
    }

    await downloadBlob(name, await response.blob())
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `${name} could not be downloaded.`})
  }
}

export const setupWebViewDownloads = () => {
  if (Capacitor.getPlatform() === "android") {
    const listener = WebViewDownload.addListener("downloadRequested", downloadFromWebView)

    return () => {
      listener.then(handle => handle.remove())
    }
  }

  return noop
}
