<script lang="ts">
  import "@src/app.css"
  import "@capacitor-community/safe-area"
  import * as nip19 from "nostr-tools/nip19"
  import type {Unsubscriber} from "svelte/store"
  import {get} from "svelte/store"
  import {App, type URLOpenListenerEvent} from "@capacitor/app"
  import {dev} from "$app/environment"
  import {goto} from "$app/navigation"
  import {sync, throttled} from "@welshman/store"
  import {call} from "@welshman/lib"
  import {defaultSocketPolicies} from "@welshman/net"
  import {pubkey, sessions, signerLog, shouldUnwrap} from "@welshman/app"
  import * as lib from "@welshman/lib"
  import * as util from "@welshman/util"
  import * as feeds from "@welshman/feeds"
  import * as router from "@welshman/router"
  import * as store from "@welshman/store"
  import * as welshmanSigner from "@welshman/signer"
  import * as net from "@welshman/net"
  import * as app from "@welshman/app"
  import {isMobile} from "@lib/html"
  import * as implicit from "@lib/implicit"
  import AppContainer from "@app/components/AppContainer.svelte"
  import ModalContainer from "@app/components/ModalContainer.svelte"
  import {setupHistory} from "@app/util/history"
  import {setupAnalytics} from "@app/util/analytics"
  import {authPolicy, blockPolicy, trustPolicy, mostlyRestrictedPolicy} from "@app/util/policies"
  import {kv, db} from "@app/core/storage"
  import {userSettingsValues} from "@app/core/state"
  import {syncApplicationData} from "@app/core/sync"
  import * as commands from "@app/core/commands"
  import * as requests from "@app/core/requests"
  import * as appState from "@app/core/state"
  import {theme} from "@app/util/theme"
  import {toast, pushToast} from "@app/util/toast"
  import * as notifications from "@app/util/notifications"
  import * as storage from "@app/util/storage"
  import {syncKeyboard} from "@app/util/keyboard"
  import NewNotificationSound from "@src/app/components/NewNotificationSound.svelte"

  const {children} = $props()

  const policies = [authPolicy, blockPolicy, trustPolicy, mostlyRestrictedPolicy]

  // Add stuff to window for convenience
  Object.assign(window, {
    get,
    nip19,
    theme,
    ...lib,
    ...implicit,
    ...welshmanSigner,
    ...router,
    ...store,
    ...util,
    ...feeds,
    ...net,
    ...app,
    ...appState,
    ...commands,
    ...requests,
    ...notifications,
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

  // Cleanup on page close
  window.addEventListener("beforeunload", () => db.close())

  const unsubscribe = call(async () => {
    const unsubscribers: Unsubscriber[] = []

    // Sync stuff to localstorage
    await Promise.all([
      sync({
        key: "pubkey",
        store: pubkey,
        storage: kv,
      }),
      sync({
        key: "sessions",
        store: sessions,
        storage: kv,
      }),
      sync({
        key: "shouldUnwrap",
        store: shouldUnwrap,
        storage: kv,
      }),
    ])

    // Set up our storage adapters
    db.adapters = storage.adapters

    // Wait until data storage is initialized before syncing other stuff
    await db.connect()

    // Close the database connection on reload
    unsubscribers.push(() => db.close())

    // Add our extra policies now that we're set up
    defaultSocketPolicies.push(...policies)

    // Remove policies when we're done
    unsubscribers.push(() => defaultSocketPolicies.splice(-policies.length))

    // History, navigation, application data
    unsubscribers.push(setupHistory(), setupAnalytics(), syncApplicationData())

    // Subscribe to badge count for changes
    unsubscribers.push(notifications.syncBadges)

    // Initialize keyboard state tracking
    unsubscribers.push(syncKeyboard())

    // Initialize background notifications
    unsubscribers.push(notifications.Push.resume())

    // Listen for signer errors, report to user via toast
    unsubscribers.push(
      throttled(10_000, signerLog).subscribe($log => {
        const cutoff = Date.now() - 3_000
        const recent = $log.filter(x => x.started_at < cutoff).slice(-10)
        const ok = recent.filter(x => x.ok)

        if (!$toast && recent.length > 5 && ok.length === 0) {
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

    // Sync theme and font size
    unsubscribers.push(
      theme.subscribe($theme => {
        document.body.setAttribute("data-theme", $theme)
      }),
      userSettingsValues.subscribe($userSettingsValues => {
        // @ts-ignore
        document.documentElement.style["font-size"] = `${$userSettingsValues.font_size}rem`
      }),
    )

    return () => unsubscribers.forEach(call)
  })

  // Cleanup on hot reload
  import.meta.hot?.dispose(() => {
    App.removeAllListeners()
    unsubscribe.then(call)
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
  <div class={isMobile ? "mobile" : ""}>
    <AppContainer>
      {@render children()}
    </AppContainer>
    <ModalContainer />
    <div class="tippy-target"></div>
    <NewNotificationSound />
  </div>
{/await}
