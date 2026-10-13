<script module lang="ts">
  const joinPrompted = new Set<string>()
  const redirectPrompted = new Set<string>()
</script>

<script lang="ts">
  import {page} from "$app/stores"
  import {navigating} from "$app/state"
  import type {Maybe} from "@welshman/lib"
  import {once} from "@welshman/lib"
  import {normalizeRelayUrl} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SocketStatusToast from "@app/components/SocketStatusToast.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpaceNotify from "@app/components/SpaceNotify.svelte"
  import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
  import SpaceRedirect from "@app/components/SpaceRedirect.svelte"
  import {derivePaidGated, deriveRelayAuthError} from "@app/features/access"
  import {user} from "@app/core/app"
  import {relays, roomLists} from "@app/core/plugins"
  import {userSpaceUrls} from "@app/features/rooms"
  import {getModal, pushModal} from "@app/ui/modal"
  import {relaysPendingTrust} from "@app/core/policies"
  import {decodeRelay} from "@app/core/relays"
  import {makeSpacePath} from "@app/ui/routes"
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()

  const url = decodeRelay(params.relay)

  const authError = deriveRelayAuthError(url)

  const paidGated = derivePaidGated(url)

  const showAuthError = once(() =>
    pushModal(SpaceAuthError, {url, error: $authError}, {noEscape: true}),
  )

  const showPaymentGate = once(() => pushModal(SpacePaymentGate, {url}, {noEscape: true}))

  const showPendingTrust = once(() => pushModal(SpaceTrustRelay, {url}, {noEscape: true}))

  // Detect a moved custom domain — the relay's nip-11 document answered with a redirect
  const checkRedirect = once(() => {
    $relays.load(url).then($relay => {
      const next = $relay?.redirect_to

      if (next) {
        redirectUrl = normalizeRelayUrl(next.replace(/^http/, "ws"))
      }
    })
  })

  const loadSpaces = async () => {
    const currentPubkey = user.get().pubkey

    if (currentPubkey) {
      // forceLoad skips the hour-stale cache and, unlike load, rethrows fetch errors.
      try {
        await $roomLists.forceLoad(currentPubkey, [url])
      } catch (error) {
        console.warn(`Failed to load room list for ${currentPubkey}`, error)
      }
    }

    spacesLoaded = true
  }

  // Track this manually since we want to avoid race conditions in which we show this prompt before we load
  let spacesLoaded = $state(false)

  let redirectUrl = $state<Maybe<string>>()

  $effect(checkRedirect)

  // A modal owns a history entry, so the join prompt waits for the page to settle.
  $effect(() => {
    if (getModal() || navigating.to) {
      return
    }

    if (redirectUrl && redirectUrl !== url && !redirectPrompted.has(url)) {
      redirectPrompted.add(url)
      pushModal(SpaceRedirect, {url, newUrl: redirectUrl})
    } else if ($paidGated) {
      showPaymentGate()
    } else if (!$userSpaceUrls.includes(url) && !joinPrompted.has(url)) {
      if (spacesLoaded) {
        joinPrompted.add(url)
        pushModal(SpaceJoin, {url})
      } else {
        loadSpaces()
      }
    } else if ($authError) {
      showAuthError()
    } else if ($relaysPendingTrust.includes(url)) {
      showPendingTrust()
    }
  })
</script>

<!-- Desktop shows the same status pinned to the space menu; on mobile that's behind the drawer -->
{#if isMobile}
  <SocketStatusToast {url} />
{/if}

{#if $page.url.pathname === makeSpacePath(url)}
  {@render children?.()}
{:else}
  <SecondaryNav>
    <SpaceMenu {url} />
  </SecondaryNav>
  <Page>
    <SpaceNotify {url} />
    <!-- SvelteKit builds a new page when the route changes and keeps the one it has when only the
         params change, so this rebuilds it for the second case. The url the page store reports
         arrives a tick after the page is built, so keying on that throws the new page away. -->
    {#key JSON.stringify(params)}
      {@render children?.()}
    {/key}
  </Page>
{/if}
