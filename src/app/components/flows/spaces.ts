import {App} from "@capacitor/app"
import {Capacitor} from "@capacitor/core"
import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
import SpaceJoin from "@app/components/SpaceJoin.svelte"
import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
import SpaceRedirect from "@app/components/SpaceRedirect.svelte"
import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
import SpaceUnreachable from "@app/components/SpaceUnreachable.svelte"
import {app} from "@app/core/app"
import {
  addSpace,
  getPendingCheckout,
  pendingCheckouts,
  promptedSteps,
  reconcileSpace,
} from "@app/tools/spaces"
import type {SpaceStep} from "@app/tools/spaces"
import {pushModal} from "@app/navigation/dialogs"
import type {ModalOptions} from "@app/navigation/dialogs"
import {pushToast} from "@app/navigation/toast"

// Paying for a space is consent to add it, so a payment that lands adds the space without asking.
const addPaidSpace = async (url: string) => {
  try {
    await addSpace(url, true)
    pushToast({message: "Welcome to the space!"})
  } catch (e) {
    console.error(e)
    pushToast({theme: "error", message: "Failed to add the space. Please try again."})
  }
}

export const openSpacePrompt = (url: string, step: SpaceStep, options: ModalOptions = {}) => {
  switch (step.step) {
    case "moved":
      return pushModal(SpaceRedirect, {url, newUrl: step.url}, options)
    case "refused":
      return pushModal(SpaceAuthError, {url, error: step.reason}, {...options, noEscape: true})
    case "unreachable":
      return pushModal(SpaceUnreachable, {url, reason: step.reason}, {...options, noEscape: true})
    case "untrusted":
      return pushModal(SpaceTrustRelay, {url}, {...options, noEscape: true})
    case "add":
      return step.paid ? addPaidSpace(url) : pushModal(SpaceJoin, {url}, options)
    case "waiting":
      // A checkout that landed adds the space by itself, so the gate opens only once a fresh check says it hasn't.
      return reconcileSpace(url)
        .catch(e => {
          console.error(e)

          return false
        })
        .then(isMember => {
          if (!isMember) {
            pushModal(SpacePaymentGate, {url}, {...options, noEscape: true})
          }
        })
    case "pay":
      return pushModal(SpacePaymentGate, {url}, {...options, noEscape: true})
    case "join":
      return pushModal(SpaceJoin, {url}, options)
  }
}

// Prompts for each step once per space per session, so a dismissed prompt stays dismissed until the step changes.
export const showSpacePrompt = (url: string, step: SpaceStep) => {
  if (promptedSteps.get(url) !== step.step) {
    promptedSteps.set(url, step.step)
    openSpacePrompt(url, step)
  }
}

// While a checkout is out, asks the space every five seconds and whenever the app comes back.
export const watchSpaceCheckout = (url: string) => {
  const check = () => {
    if (getPendingCheckout(pendingCheckouts.get(), url, app.get().user?.pubkey)) {
      reconcileSpace(url).catch(e => console.error(e))
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      check()
    }
  }

  const interval = setInterval(check, 5000)
  const listener = Capacitor.isNativePlatform()
    ? App.addListener("appStateChange", ({isActive}) => isActive && check())
    : undefined

  document.addEventListener("visibilitychange", onVisibilityChange)

  return () => {
    clearInterval(interval)
    listener?.then(handle => handle.remove())
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }
}
