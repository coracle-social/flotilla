<script lang="ts">
  import "@app/ui/app.css"
  import "@welshman/editor/index.css"
  import * as nip19 from "nostr-tools/nip19"
  import type {Unsubscriber} from "svelte/store"
  import {get} from "svelte/store"
  import {App} from "@capacitor/app"
  import {Capacitor} from "@capacitor/core"
  import {NostrSignerPlugin} from "nostr-signer-capacitor-plugin"
  import {dev} from "$app/environment"
  import {page} from "$app/stores"
  import {context as pomadeContext} from "@pomade/core"
  import {setNip55Plugin} from "@welshman/signer"
  import * as util from "@welshman/util"
  import * as lib from "@welshman/lib"
  import * as plugins from "@welshman/app"
  import {isMobile, documentActive} from "@lib/html"
  import AppContainer from "@app/components/AppContainer.svelte"
  import Startup from "@app/components/Startup.svelte"
  import ModalContainer from "@app/components/ModalContainer.svelte"
  import * as coreApp from "@app/core/app"
  import {app} from "@app/core/app"
  import * as coreDomain from "@app/core/domain"
  import * as corePlugins from "@app/core/plugins"
  import {setupHistory} from "@app/ui/routes"
  import {setupAnalytics} from "@app/features/analytics"
  import {setupLogging} from "@app/core/logger"
  import "@app/core/policies"
  import * as coreSession from "@app/core/session"
  import {restoreSession} from "@app/core/session"
  import {syncSignerAlerts} from "@app/core/signer"
  import {wallet} from "@app/features/lightning"
  import {storage} from "@app/core/storage"
  import {device} from "@app/core/device"
  import {forceHealthChecks} from "@app/features/healthChecks"
  import {setupShareIntents} from "@app/ui/share"
  import {shouldUnwrap, syncApplicationData} from "@app/core/sync"
  import * as env from "@app/core/env"
  import {applySavedTheme, flTheme, syncTheme, theme} from "@app/ui/theme"
  import * as notifications from "@app/ui/notifications"
  import {notificationCount, backgroundNotificationCount} from "@app/ui/notifications"
  import {Push, notificationSettings} from "@app/features/push"
  import {pushState} from "@app/features/push/adapters/common"
  import {setupDeepLinks} from "@app/features/deepLinks"
  import {syncKeyboard} from "@app/ui/keyboard"
  import {getPageTitle} from "@app/ui/title"
  import NewNotificationSound from "@src/app/components/NewNotificationSound.svelte"
  import type {LayoutProps} from "./$types"

  const {children}: LayoutProps = $props()

  applySavedTheme()

  // Add stuff to window for convenience
  Object.assign(window, {
    get,
    nip19,
    theme,
    notifications,
    ...plugins,
    ...lib,
    ...util,
    ...coreApp,
    ...corePlugins,
    ...coreDomain,
    ...coreSession,
  })

  // Set up context for various modules
  pomadeContext.setSignerUrls(env.POMADE_SIGNERS)
  pomadeContext.setArgonWorker(import("@pomade/core/argon-worker.js?worker"))

  if (Capacitor.getPlatform() === "android") {
    setNip55Plugin(NostrSignerPlugin)
  }

  // Handle back button on mobile
  App.addListener("backButton", () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })

  const closeStorage = () => storage.get()?.close()

  // Cleanup on page close
  window.addEventListener("beforeunload", closeStorage)

  const unsubscribe = lib.call(async () => {
    const unsubscribers: Unsubscriber[] = []

    // Attach the user before anything reads or decrypts on their behalf
    unsubscribers.push(await restoreSession())

    // Set up logging
    unsubscribers.push(setupLogging())

    // Boot code reads these, e.g. Push picks its adapter from pushState, so wait for stored values
    await Promise.all([
      device.ready,
      shouldUnwrap.ready,
      wallet.ready,
      notificationSettings.ready,
      pushState.ready,
      forceHealthChecks.ready,
    ])

    // Wait for critical storage data only
    await storage.get()?.ready

    // Handle warm and cold start deep links
    unsubscribers.push(await setupDeepLinks())

    // Close the database connection on reload
    unsubscribers.push(closeStorage)

    // History, navigation, application data
    unsubscribers.push(setupHistory(), setupAnalytics(), syncApplicationData())

    // Listen for links shared into the app from elsewhere on the device
    unsubscribers.push(setupShareIntents())

    // Initialize keyboard state tracking
    unsubscribers.push(syncKeyboard())

    // Subscribe to badge count for changes
    unsubscribers.push(notifications.syncBadges())

    // Subscribe to page history to update checked state
    unsubscribers.push(notifications.syncChecked())

    // Sync checked state across devices
    unsubscribers.push(notifications.syncCheckedRemote())

    // Initialize background notifications
    unsubscribers.push(Push.sync())

    // Wait for the new app's storage the way startup does, so sync reconciles against cached events.
    let currentApp = app.get()

    const resync = async () => {
      await storage.get()?.ready

      syncApplicationData()
    }

    unsubscribers.push(
      app.subscribe(nextApp => {
        if (nextApp !== currentApp) {
          currentApp = nextApp
          resync()
        }
      }),
    )

    // Listen for signer errors, report to user via toast
    unsubscribers.push(syncSignerAlerts())

    // Sync theme and font size
    unsubscribers.push(syncTheme())

    return () => unsubscribers.forEach(lib.call)
  })

  // Cleanup on hot reload
  import.meta.hot?.dispose(() => {
    App.removeAllListeners()
    unsubscribe.then(lib.call)
  })

  $effect(() => {
    const title = getPageTitle({page: $page, pubkey: $app.user?.pubkey})
    const count = $documentActive ? $notificationCount : $backgroundNotificationCount

    document.title = count > 0 ? `(${count}) ${title}` : title
  })
</script>

<svelte:head>
  {#if !dev}
    <link rel="manifest" href="/manifest.webmanifest" />
  {/if}
</svelte:head>

<div class={isMobile ? "fl mobile" : "fl"} data-fl-theme={$flTheme}>
  {#await unsubscribe}
    <Startup />
  {:then}
    <AppContainer>
      {@render children()}
    </AppContainer>
    <ModalContainer />
    <div class="tippy-target"></div>
    <NewNotificationSound />
  {:catch error}
    <Startup {error} />
  {/await}
</div>
