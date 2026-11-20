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
  import {stripPrefix} from "@lib/util"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpaceNotify from "@app/components/SpaceNotify.svelte"
  import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
  import SpaceRedirect from "@app/components/SpaceRedirect.svelte"
  import {goToMovedSpace} from "@app/navigation/history"
  import {derivePaidGated} from "@app/areas/spaces/payments"
  import {user} from "@app/core/user"
  import {authenticate} from "@app/core/auth"
  import {RelayAccessStatus, deriveRelayAccess} from "@app/core/relays"
  import {relays, roomLists} from "@app/core/plugins"
  import {userSpaceUrls} from "@app/core/user"
  import {getModal, pushModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"
  import {promptLogin} from "@app/components/flows/login"
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()

  const {url} = pages.space.decode(params)

  const access = deriveRelayAccess(url)

  const paidGated = derivePaidGated(url)

  const showAuthError = once((error: string) =>
    pushModal(SpaceAuthError, {url, error}, {noEscape: true}),
  )

  const showPaymentGate = once(() => pushModal(SpacePaymentGate, {url}, {noEscape: true}))

  const showPendingTrust = once(() => pushModal(SpaceTrustRelay, {url}, {noEscape: true}))

  const showLoginPrompt = once(() => promptLogin("see this space"))

  // Settling a refusal or trusting a relay takes an account, so a visitor is asked to log in instead.
  const turnAway = () => {
    turnedAway = true
    showLoginPrompt()
  }

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
    const currentPubkey = user.get()?.pubkey

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

  // A space that turned a visitor away loaded nothing for them, so its pages start over once they log in.
  let turnedAway = $state(false)

  // Visiting a space is asking to join it, while a visitor who logs in here came for something else.
  const arrivedSignedIn = Boolean(user.get())

  $effect(checkRedirect)

  // A modal owns a history entry, so the join prompt waits for the page to settle.
  $effect(() => {
    if (getModal() || navigating.to) {
      return
    }

    if (redirectUrl && redirectUrl !== url && !redirectPrompted.has(url)) {
      redirectPrompted.add(url)

      // A visitor has no spaces list to update, so they just follow the space.
      if ($user) {
        pushModal(SpaceRedirect, {url, newUrl: redirectUrl})
      } else {
        goToMovedSpace(url, redirectUrl)
      }
    } else if ($paidGated) {
      showPaymentGate()
    } else if (arrivedSignedIn && !$userSpaceUrls.includes(url) && !joinPrompted.has(url)) {
      if (spacesLoaded) {
        joinPrompted.add(url)
        pushModal(SpaceJoin, {url})
      } else {
        loadSpaces()
      }
    } else if ($access.status === RelayAccessStatus.LoginRequired) {
      turnAway()
    } else if ($access.status === RelayAccessStatus.Denied) {
      if ($user) {
        showAuthError(stripPrefix($access.reason))
      } else {
        turnAway()
      }
    } else if ($access.status === RelayAccessStatus.Untrusted) {
      if ($user) {
        showPendingTrust()
      } else {
        turnAway()
      }
    }
  })

  // Visiting a space is intent enough to identify to it, and requests it refused for auth are sent again once that's done.
  $effect(() => {
    if ($user) {
      authenticate(url)
    }
  })
</script>

{#key turnedAway && $user?.pubkey}
  {#if $page.url.pathname === pages.space.path({url})}
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
{/key}
