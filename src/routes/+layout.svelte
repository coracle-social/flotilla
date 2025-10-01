<script lang="ts">
  import "@src/app.css"
  import "@capacitor-community/safe-area"
  import {throttle} from "throttle-debounce"
  import {onMount} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import {get, derived} from "svelte/store"
  import {App, type URLOpenListenerEvent} from "@capacitor/app"
  import {dev} from "$app/environment"
  import {goto} from "$app/navigation"
  import {sync, localStorageProvider} from "@welshman/store"
  import {
    ago,
    assoc,
    call,
    defer,
    dissoc,
    identity,
    memoize,
    on,
    sleep,
    spec,
    TaskQueue,
    WEEK,
  } from "@welshman/lib"
  import type {TrustedEvent, StampedEvent} from "@welshman/util"
  import {WRAP} from "@welshman/util"
  import {Nip46Broker, makeSecret} from "@welshman/signer"
  import type {Socket, RelayMessage, ClientMessage} from "@welshman/net"
  import {
    request,
    defaultSocketPolicies,
    makeSocketPolicyAuth,
    SocketEvent,
    isRelayEvent,
    isRelayOk,
    isRelayClosed,
    isClientReq,
    isClientEvent,
    isClientClose,
  } from "@welshman/net"
  import {
    loadRelay,
    repository,
    pubkey,
    session,
    sessions,
    signer,
    signerLog,
    dropSession,
    loginWithNip01,
    loginWithNip46,
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
  import {nsecDecode} from "@lib/util"
  import {preferencesStorageProvider} from "@lib/storage"
  import AppContainer from "@app/components/AppContainer.svelte"
  import ModalContainer from "@app/components/ModalContainer.svelte"
  import {setupTracking} from "@app/util/tracking"
  import {setupAnalytics} from "@app/util/analytics"
  import {
    INDEXER_RELAYS,
    userMembership,
    userSettingsValues,
    relaysPendingTrust,
    ensureUnwrapped,
    canDecrypt,
    getSetting,
    relaysMostlyRestricted,
    userInboxRelays,
  } from "@app/core/state"
  import {loadUserData, listenForNotifications} from "@app/core/requests"
  import {theme} from "@app/util/theme"
  import {toast, pushToast} from "@app/util/toast"
  import {initializePushNotifications} from "@app/util/push"
  import * as commands from "@app/core/commands"
  import * as requests from "@app/core/requests"
  import * as appState from "@app/core/state"
  import * as notifications from "@app/util/notifications"
  import * as storage from "@app/util/storage"
  import NewNotificationSound from "@src/app/components/NewNotificationSound.svelte"

  // Migration: delete old indexeddb database
  indexedDB?.deleteDatabase("flotilla")

  // Migration: old nostrtalk instance used different sessions
  if ($session && !$signer) {
    dropSession($session.pubkey)
  }

  // Initialize push notification handler asap
  initializePushNotifications()

  const {children} = $props()

  const ready = $state(defer<void>())

  let initialized = false

  onMount(async () => {
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

    // migrate from localStorage to capacitor Preferences storage if needed
    const runMigration = async () => {
      const isSome = (item: any) => {
        return item !== undefined && item !== null && item !== ""
      }

      const localStoragePubKey = await localStorageProvider.get("pubkey")
      if (isSome(localStoragePubKey)) {
        await preferencesStorageProvider.set("pubkey", localStoragePubKey)
        localStorage.removeItem("pubkey")
      }

      const localStorageSessions = await localStorageProvider.get("sessions")
      if (isSome(localStorageSessions)) {
        await preferencesStorageProvider.set("sessions", localStorageSessions)
        localStorage.removeItem("sessions")
      }

      const localStorageCanDecrypt = await localStorageProvider.get("canDecrypt")
      if (isSome(localStorageCanDecrypt)) {
        await preferencesStorageProvider.set("canDecrypt", localStorageCanDecrypt)
        localStorage.removeItem("canDecrypt")
      }

      const localStorageChecked = await localStorageProvider.get("checked")
      if (isSome(localStorageChecked)) {
        await preferencesStorageProvider.set("checked", localStorageChecked)
        localStorage.removeItem("checked")
      }

      const localStorageTheme = await localStorageProvider.get("theme")
      if (isSome(localStorageTheme)) {
        await preferencesStorageProvider.set("theme", localStorageTheme)
        localStorage.removeItem("theme")
      }
    }
    await runMigration()

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

    // Nstart login
    if (window.location.hash?.startsWith("#nostr-login")) {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const login = params.get("nostr-login")

      let success = false

      try {
        if (login?.startsWith("bunker://")) {
          const clientSecret = makeSecret()
          const {signerPubkey, connectSecret, relays} = Nip46Broker.parseBunkerUrl(login)
          const broker = new Nip46Broker({relays, clientSecret, signerPubkey})
          const result = await broker.connect(connectSecret, appState.NIP46_PERMS)
          const pubkey = await broker.getPublicKey()

          // TODO: remove ack result
          if (pubkey && ["ack", connectSecret].includes(result)) {
            await loadUserData(pubkey)

            loginWithNip46(pubkey, clientSecret, signerPubkey, relays)
            broker.cleanup()
            success = true
          }
        } else if (login) {
          loginWithNip01(nsecDecode(login))
          success = true
        }
      } catch (e) {
        console.error(e)
      }

      if (success) {
        goto("/home")
      }
    }

    // Sync theme
    theme.subscribe($theme => {
      document.body.setAttribute("data-theme", $theme)
    })

    // Sync font size
    userSettingsValues.subscribe($userSettingsValues => {
      // @ts-ignore
      document.documentElement.style["font-size"] = `${$userSettingsValues.font_size}rem`
    })

    if (!initialized) {
      initialized = true
      setupTracking()
      setupAnalytics()

      App.addListener("backButton", () => {
        if (window.history.length > 1) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })

      // Unwrap gift wraps as they come in, but throttled
      const unwrapper = new TaskQueue<TrustedEvent>({batchSize: 10, processItem: ensureUnwrapped})

      repository.on("update", ({added}) => {
        for (const event of added) {
          loadRelaySelections(event.pubkey)

          if ($canDecrypt && event.kind === WRAP) {
            unwrapper.push(event)
          }
        }
      })

      // Sync current pubkey
      await sync({
        key: "pubkey",
        store: pubkey,
        storage: preferencesStorageProvider,
      })

      // Sync user sessions
      await sync({
        key: "sessions",
        store: sessions,
        storage: preferencesStorageProvider,
      })

      // Sync application data (relay, events, etc)
      await storage.syncDataStores()

      // Wait 300 ms for any throttled stores to finish
      sleep(300).then(() => ready.resolve())

      defaultSocketPolicies.push(
        makeSocketPolicyAuth({
          sign: (event: StampedEvent) => signer.get()?.sign(event),
          shouldAuth: (socket: Socket) => true,
        }),
        (socket: Socket) => {
          const buffer: RelayMessage[] = []

          const unsubscribers = [
            // When the socket goes from untrusted to trusted, receive all buffered messages
            userSettingsValues.subscribe($settings => {
              if ($settings.trusted_relays.includes(socket.url)) {
                for (const message of buffer.splice(0)) {
                  socket._recvQueue.push(message)
                }
              }
            }),
            // When we get an event with no signature from an untrusted relay, remove it from
            // the receive queue. If trust status is undefined, buffer it for later.
            on(socket, SocketEvent.Receiving, (message: RelayMessage) => {
              if (isRelayEvent(message) && !message[2]?.sig) {
                const isTrusted = getSetting<string[]>("trusted_relays").includes(socket.url)

                if (!isTrusted) {
                  socket._recvQueue.remove(message)
                  buffer.push(message)

                  if (!$relaysPendingTrust.includes(socket.url)) {
                    relaysPendingTrust.update($r => [...$r, socket.url])
                  }
                }
              }
            }),
          ]

          return () => {
            unsubscribers.forEach(call)
          }
        },
        function monitorRestrictedResponses(socket: Socket) {
          let total = 0
          let restricted = 0
          let error = ""

          const pending = new Set<string>()

          const updateStatus = () =>
            relaysMostlyRestricted.update(
              restricted > total / 2 ? assoc(socket.url, error) : dissoc(socket.url),
            )

          const unsubscribers = [
            on(socket, SocketEvent.Receive, (message: RelayMessage) => {
              if (isRelayOk(message)) {
                const [_, id, ok, details = ""] = message

                if (pending.has(id)) {
                  pending.delete(id)

                  if (!ok && details.startsWith("restricted: ")) {
                    restricted++
                    error = details
                    updateStatus()
                  }
                }
              }

              if (isRelayClosed(message)) {
                const [_, id, details = ""] = message

                if (pending.has(id)) {
                  pending.delete(id)

                  if (details.startsWith("restricted: ")) {
                    restricted++
                    error = details
                    updateStatus()
                  }
                }
              }
            }),
            on(socket, SocketEvent.Send, (message: ClientMessage) => {
              if (isClientReq(message)) {
                total++
                pending.add(message[1])
                updateStatus()
              }

              if (isClientEvent(message)) {
                total++
                pending.add(message[1].id)
                updateStatus()
              }

              if (isClientClose(message)) {
                pending.delete(message[1])
              }
            }),
          ]

          return () => {
            unsubscribers.forEach(call)
          }
        },
      )

      // Load relay info
      for (const url of INDEXER_RELAYS) {
        loadRelay(url)
      }

      // Load user data
      if ($pubkey) {
        await loadUserData($pubkey)
      }

      // Listen for space data, populate space-based notifications
      let unsubSpaces: any

      userMembership.subscribe(
        memoize($membership => {
          unsubSpaces?.()
          unsubSpaces = listenForNotifications()
        }),
      )

      // Listen for chats, populate chat-based notifications
      let controller: AbortController

      derived([pubkey, canDecrypt, userInboxRelays], identity).subscribe(
        ([$pubkey, $canDecrypt, $userInboxRelays]) => {
          controller?.abort()
          controller = new AbortController()

          if ($pubkey && $canDecrypt) {
            request({
              signal: controller.signal,
              relays: $userInboxRelays,
              filters: [
                {kinds: [WRAP], "#p": [$pubkey], since: ago(WEEK, 2)},
                {kinds: [WRAP], "#p": [$pubkey], limit: 100},
              ],
            })
          }
        },
      )

      // subscribe to badge count for changes
      notifications.badgeCount.subscribe(notifications.handleBadgeCountChanges)

      // Listen for signer errors, report to user via toast
      signerLog.subscribe(
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
    }
  })
</script>

<svelte:head>
  {#if !dev}
    <link rel="manifest" href="/manifest.webmanifest" />
  {/if}
</svelte:head>

{#await ready}
  <div></div>
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
