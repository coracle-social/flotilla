<script lang="ts">
  import "@lib/components/theme.css"
  import "@welshman/editor/index.css"
  import {debounce} from "throttle-debounce"
  import * as nip19 from "nostr-tools/nip19"
  import type {Unsubscriber} from "svelte/store"
  import {get} from "svelte/store"
  import {App, type URLOpenListenerEvent} from "@capacitor/app"
  import {Capacitor} from "@capacitor/core"
  import {NostrSignerPlugin} from "nostr-signer-capacitor-plugin"
  import {dev} from "$app/environment"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import {context as pomadeContext} from "@pomade/core"
  import {sync, throttled} from "@welshman/store"
  import {setNip55Plugin} from "@welshman/signer"
  import * as util from "@welshman/util"
  import * as lib from "@welshman/lib"
  import * as plugins from "@welshman/app"
  import {isMobile, documentActive} from "@lib/html"
  import AppContainer from "@app/components/AppContainer.svelte"
  import ModalContainer from "@app/components/ModalContainer.svelte"
  import * as core from "@app/core"
  import {goToChat, goToHome, setupHistory} from "@app/routes"
  import Search from "@app/components/Search.svelte"
  import {clearModals, getModal, navigate, pushModal} from "@app/modal"
  import {setupAnalytics} from "@app/analytics"
  import {setupLogging} from "@app/logger"
  import "@app/policies"
  import {restoreSession} from "@app/session"
  import {signerRequests} from "@app/signer"
  import {wallet} from "@app/lightning"
  import {kv, ss, storage} from "@app/storage"
  import {device} from "@app/device"
  import {userSettingsValues, notificationSettings} from "@app/settings"
  import {setupShareIntents, shareFromNative} from "@app/share"
  import {shouldUnwrap, syncApplicationData} from "@app/sync"
  import * as env from "@app/env"
  import {activeTheme, flTheme, theme} from "@app/theme"
  import {toast, pushToast} from "@app/toast"
  import * as notifications from "@app/notifications"
  import {notificationCount, backgroundNotificationCount} from "@app/notifications"
  import {Push} from "@app/push"
  import {onPushNotificationAction, pushState} from "@app/push/adapters/common"
  import {syncKeyboard} from "@app/keyboard"
  import {getPageTitle} from "@app/title"
  import NewNotificationSound from "@src/app/components/NewNotificationSound.svelte"

  const {children} = $props()

  // Do this asap to avoid a flash of the wrong font size or theme. The stores these mirror live in
  // indexeddb, which doesn't load until well after first paint.
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const savedTheme = localStorage.getItem("theme")
  const initialTheme =
    savedTheme === "light" || savedTheme === "dark" ? savedTheme : prefersDark ? "dark" : "light"

  // @ts-ignore
  document.documentElement.style["font-size"] = `${localStorage.getItem("font-size") || 1.1}rem`
  document.documentElement.style.colorScheme = initialTheme
  document.body.setAttribute("data-fl-theme", localStorage.getItem("fl-theme") || env.FL_THEME)
  document.body.setAttribute("data-theme", initialTheme)

  // Add stuff to window for convenience
  Object.assign(window, {get, nip19, theme, ...plugins, ...lib, ...util, ...core})

  // Set up context for various modules
  pomadeContext.setSignerUrls(env.POMADE_SIGNERS)
  pomadeContext.setArgonWorker(import("@pomade/core/argon-worker.js?worker"))

  if (Capacitor.getPlatform() === "android") {
    setNip55Plugin(NostrSignerPlugin)
  }

  // Handle a deep link (universal/app link or custom scheme). Used for both
  // warm-start links (via the appUrlOpen event) and cold-start links (via
  // getLaunchUrl below) so the invite relay/claim query params are preserved
  // in either case.
  const handleDeepLink = (rawUrl: string) => {
    const url = new URL(rawUrl)
    const relay = url.searchParams.get("relay")
    const id = url.searchParams.get("id")

    if (relay && id) {
      onPushNotificationAction({notification: {data: {relay, id}}})
      return
    }

    if (url.protocol === "flotilla:" && url.host === "shortcut") {
      if (core.app.get().user) {
        switch (url.pathname) {
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

      return
    }

    // The iOS share extension can't talk to us directly, so it hands its payload over as a
    // flotilla://share url
    if (url.host === "share") {
      shareFromNative(Object.fromEntries(url.searchParams))
      return
    }

    if (url.host === "x-callback-url") {
      if (url.pathname === "/authError") {
        const errorMessage = url.searchParams.get("errorMessage")

        pushToast({
          theme: "error",
          message: errorMessage || "Signer authorization failed.",
        })
      }

      if (["/authSuccess", "/authError"].includes(url.pathname)) {
        return
      }
    }

    const target = `${url.pathname}${url.search}${url.hash}`
    goto(target, {replaceState: false, noScroll: false})
  }

  // Listen for deep link events. Capacitor only emits this from onNewIntent, so
  // it fires when the app is already running (warm start). Cold-start links are
  // handled by getLaunchUrl in the setup block below.
  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => handleDeepLink(event.url))

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

    // Sync stuff to storage
    await Promise.all([
      sync({
        key: "device",
        store: device,
        storage: kv,
      }),
      sync({
        key: "shouldUnwrap",
        store: shouldUnwrap,
        storage: kv,
      }),
      sync({
        key: "wallet",
        store: wallet,
        storage: ss,
      }),
      sync({
        key: "notificationSettings",
        store: notificationSettings,
        storage: kv,
      }),
      sync({
        key: "notificationState",
        store: pushState,
        storage: kv,
      }),
    ])

    // Wait for critical storage data only
    await storage.get()?.ready

    // Handle cold-start deep links. When a link launches the app from a killed
    // state the intent arrives via onCreate, so Capacitor never emits
    // appUrlOpen for it — the URL is only reachable through getLaunchUrl.
    // Without this, invite links opened while the app is closed lose their
    // relay/claim params and the space is never joined.
    const launch = await App.getLaunchUrl()

    if (launch?.url) {
      handleDeepLink(launch.url)
    }

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

    // Logging in swaps in a fresh app — its policies rebind themselves, we just have to sync
    // application data against the new identity's relays. Wait for the new app's storage to
    // load the way startup does, so sync reconciles against cached events.
    let currentApp = core.app.get()

    const resync = async () => {
      await storage.get()?.ready

      syncApplicationData()
    }

    unsubscribers.push(
      core.app.subscribe($app => {
        if ($app !== currentApp) {
          currentApp = $app
          resync()
        }
      }),
    )

    // Listen for signer errors, report to user via toast
    unsubscribers.push(
      throttled(10_000, signerRequests).subscribe($requests => {
        if ($toast) {
          return
        }

        const longCutoff = Date.now() - 30_000
        const shortCutoff = Date.now() - 10_000
        const pending = $requests.filter(r => !r.finishedAt && r.startedAt < longCutoff)
        const completed = $requests.filter(r => r.finishedAt && r.finishedAt > shortCutoff)
        const showPendingError = pending.length > 10
        const showCompletedError = completed.length > 5 && completed.filter(r => r.ok).length === 0

        if (showPendingError || showCompletedError) {
          pushToast({
            theme: "error",
            timeout: 60_000,
            message: "Your signer isn't responding.",
            action: {
              message: "Details",
              onclick: () => goto("/settings/profile"),
            },
          })
        }
      }),
    )

    // Sync theme and font size
    unsubscribers.push(
      activeTheme.subscribe($activeTheme => {
        localStorage.setItem("theme", $activeTheme)
        document.body.setAttribute("data-theme", $activeTheme)
        document.documentElement.style.colorScheme = $activeTheme
      }),
      flTheme.subscribe($flTheme => {
        localStorage.setItem("fl-theme", $flTheme)
        document.body.setAttribute("data-fl-theme", $flTheme)
      }),
      userSettingsValues.subscribe(
        debounce(100, $settings => {
          localStorage.setItem("font-size", String($settings.font_size))

          // @ts-ignore
          document.documentElement.style["font-size"] = `${$settings.font_size}rem`
        }),
      ),
    )

    return () => unsubscribers.forEach(lib.call)
  })

  // Cleanup on hot reload
  import.meta.hot?.dispose(() => {
    App.removeAllListeners()
    unsubscribe.then(lib.call)
  })

  $effect(() => {
    const {user} = core.app.get()
    const title = getPageTitle({page: $page, pubkey: user?.pubkey})
    const count = $documentActive ? $notificationCount : $backgroundNotificationCount

    document.title = count > 0 ? `(${count}) ${title}` : title
  })
</script>

<svelte:head>
  {#if !dev}
    <link rel="manifest" href="/manifest.webmanifest" />
  {/if}
</svelte:head>

{#await unsubscribe}
  <!-- pass -->
{:then}
  <div class={isMobile ? "fl mobile" : "fl"} data-fl-theme={$flTheme}>
    <AppContainer>
      {@render children()}
    </AppContainer>
    <ModalContainer />
    <div class="tippy-target"></div>
    <NewNotificationSound />
  </div>
{/await}
