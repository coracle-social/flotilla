<script lang="ts">
  import "@src/app.css"
  import "@capacitor-community/safe-area"
  import {throttle} from "throttle-debounce"
  import * as nip19 from "nostr-tools/nip19"
  import {get} from "svelte/store"
  import {App, type URLOpenListenerEvent} from "@capacitor/app"
  import {dev} from "$app/environment"
  import {goto} from "$app/navigation"
  import {sync} from "@welshman/store"
  import {call, on, spec} from "@welshman/lib"
  import {defaultSocketPolicies} from "@welshman/net"
  import {
    repository,
    pubkey,
    sessions,
    signerLog,
    shouldUnwrap,
    loadRelaySelections,
    SignerLogEntryStatus,
  } from "@welshman/app"
  import * as lib from "@welshman/lib"
  import * as util from "@welshman/util"
  import * as feeds from "@welshman/feeds"
  import * as router from "@welshman/router"
  import * as welshmanSigner from "@welshman/signer"
  import * as net from "@welshman/net"
  import * as app from "@welshman/app"
  import {preferencesStorageProvider} from "@lib/storage"
  import AppContainer from "@app/components/AppContainer.svelte"
  import ModalContainer from "@app/components/ModalContainer.svelte"
  import {setupHistory} from "@app/util/history"
  import {setupTracking} from "@app/util/tracking"
  import {setupAnalytics} from "@app/util/analytics"
  import {authPolicy, trustPolicy, mostlyRestrictedPolicy} from "@app/util/policies"
  import {userSettingsValues} from "@app/core/state"
  import {syncApplicationData} from "@app/core/sync"
  import {theme} from "@app/util/theme"
  import {toast, pushToast} from "@app/util/toast"
  import {initializePushNotifications} from "@app/util/push"
  import * as commands from "@app/core/commands"
  import * as requests from "@app/core/requests"
  import * as appState from "@app/core/state"
  import * as notifications from "@app/util/notifications"
  import * as storage from "@app/util/storage"
  import NewNotificationSound from "@src/app/components/NewNotificationSound.svelte"

  const {children} = $props()

  // Add stuff to window for convenience
  Object.assign(window, {
    get,
    nip19,
    theme,
    ...lib,
    ...welshmanSigner,
    ...router,
    ...util,
    ...feeds,
    ...net,
    ...app,
    ...appState,
    ...commands,
    ...requests,
    ...notifications,
  })

  // Initialize push notification handler asap
  initializePushNotifications()

  // Listen for navigation messages from service worker
  navigator.serviceWorker?.addEventListener("message", event => {
    if (event.data && event.data.type === "NAVIGATE") {
      goto(event.data.url)
    }
  })

  // Listen for deep link events
  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    const url = new URL(event.url)
    const target = `${url.pathname}${url.search}${url.hash}`
    goto(target, {replaceState: false, noScroll: false})
  })

  // Handle back button on mobile
  App.addListener("backButton", () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })

  // Listen to navigation changes
  const unsubscribeHistory = setupHistory()

  // Report usage on navigation change
  const unsubscribeAnalytics = setupAnalytics()

  // Bug tracking
  const unsubscribeTracking = setupTracking()

  // Load user data, listen for messages, etc
  const unsubscribeApplicationData = syncApplicationData()

  // Whenever we see a new pubkey, load their outbox event
  const unsubscribeRepository = on(repository, "update", ({added}) => {
    for (const event of added) {
      loadRelaySelections(event.pubkey)
    }
  })

  // Subscribe to badge count for changes
  const unsubscribeBadgeCount = notifications.badgeCount.subscribe(
    notifications.handleBadgeCountChanges,
  )

  // Listen for signer errors, report to user via toast
  const unsubscribeSignerLog = signerLog.subscribe(
    throttle(10_000, $log => {
      const recent = $log.slice(-10)
      const success = recent.filter(spec({status: SignerLogEntryStatus.Success}))
      const failure = recent.filter(spec({status: SignerLogEntryStatus.Failure}))

      if (!$toast && failure.length > 5 && success.length === 0) {
        pushToast({
          theme: "error",
          timeout: 60_000,
          message: "Your signer appears to be unresponsive.",
          action: {
            message: "Details",
            onclick: () => goto("/settings/profile"),
          },
        })
      }
    }),
  )

  // Sync theme
  const unsubscribeTheme = theme.subscribe($theme => {
    document.body.setAttribute("data-theme", $theme)
  })

  // Sync font size
  const unsubscribeSettings = userSettingsValues.subscribe($userSettingsValues => {
    // @ts-ignore
    document.documentElement.style["font-size"] = `${$userSettingsValues.font_size}rem`
  })

  const unsubscribeStorage = call(async () => {
    // Sync stuff to localstorage
    await Promise.all([
      sync({
        key: "pubkey",
        store: pubkey,
        storage: preferencesStorageProvider,
      }),
      sync({
        key: "sessions",
        store: sessions,
        storage: preferencesStorageProvider,
      }),
      sync({
        key: "shouldUnwrap",
        store: shouldUnwrap,
        storage: preferencesStorageProvider,
      }),
    ])

    // Sync stuff to indexeddb
    return await storage.syncDataStores()
  })

  // Default socket policies
  const additionalPolicies = [authPolicy, trustPolicy, mostlyRestrictedPolicy]

  defaultSocketPolicies.push(...additionalPolicies)

  // Cleanup on hot reload
  import.meta.hot?.dispose(() => {
    App.removeAllListeners()
    unsubscribeHistory()
    unsubscribeAnalytics()
    unsubscribeTracking()
    unsubscribeApplicationData()
    unsubscribeRepository()
    unsubscribeBadgeCount()
    unsubscribeSignerLog()
    unsubscribeTheme()
    unsubscribeSettings()
    unsubscribeStorage.then(call)
    defaultSocketPolicies.splice(-additionalPolicies.length)
  })
</script>

<svelte:head>
  {#if !dev}
    <link rel="manifest" href="/manifest.webmanifest" />
  {/if}
</svelte:head>

{#await unsubscribeStorage}
  <!-- pass -->
{:then}
  <div>
    <AppContainer>
      {@render children()}
    </AppContainer>
    <ModalContainer />
    <div class="tippy-target"></div>
    <NewNotificationSound />
  </div>
{/await}
