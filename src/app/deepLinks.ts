import {App} from "@capacitor/app"
import type {URLOpenListenerEvent} from "@capacitor/app"
import {goto} from "$app/navigation"
import {app} from "@app/core"
import {clearModals, getModal, navigate, pushModal} from "@app/modal"
import {goToChat, goToHome} from "@app/routes"
import {shareFromNative} from "@app/share"
import {pushToast} from "@app/toast"
import {onPushNotificationAction} from "@app/push/adapters/common"
import Search from "@app/components/Search.svelte"

const openShortcut = (pathname: string) => {
  switch (pathname) {
    case "/messages":
      goToChat()
      break
    case "/search": {
      const modal = getModal()

      if (modal?.component !== Search) {
        pushModal(Search, {}, {replaceState: Boolean(modal)})
      }
      break
    }
    case "/spaces":
      navigate("/spaces")
      break
    case "/inbox":
      clearModals()
      goToHome()
      break
  }
}

const handleDeepLink = (rawUrl: string) => {
  const url = new URL(rawUrl)
  const relay = url.searchParams.get("relay")
  const id = url.searchParams.get("id")

  if (relay && id) {
    onPushNotificationAction({notification: {data: {relay, id}}})
  } else if (url.protocol === "flotilla:" && url.host === "shortcut") {
    if (app.get().user) {
      openShortcut(url.pathname)
    }
  } else if (url.host === "share") {
    // The iOS share extension has no channel to the app, so it posts a flotilla://share url.
    shareFromNative(Object.fromEntries(url.searchParams))
  } else if (url.host === "x-callback-url" && url.pathname === "/authError") {
    pushToast({
      theme: "error",
      message: url.searchParams.get("errorMessage") || "Signer authorization failed.",
    })
  } else if (url.host !== "x-callback-url" || url.pathname !== "/authSuccess") {
    goto(`${url.pathname}${url.search}${url.hash}`, {replaceState: false, noScroll: false})
  }
}

export const setupDeepLinks = async () => {
  // Capacitor emits this from onNewIntent only, and retains it until a listener is attached.
  const listener = await App.addListener("appUrlOpen", (event: URLOpenListenerEvent) =>
    handleDeepLink(event.url),
  )

  // A link launching the app from a killed state arrives via onCreate, which emits no appUrlOpen.
  const launch = await App.getLaunchUrl()

  if (launch?.url) {
    handleDeepLink(launch.url)
  }

  return () => listener.remove()
}
