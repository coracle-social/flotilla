<script module lang="ts">
  const joinPrompted = new Set<string>()
  const redirectPrompted = new Set<string>()
</script>

<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
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
  import SpaceRedirect from "@app/components/SpaceRedirect.svelte"
  import {deriveRelayAuthError} from "@app/access"
  import {relays, roomLists, user} from "@app/core"
  import {userSpaceUrls} from "@app/rooms"
  import {modal, pushModal} from "@app/modal"
  import {relaysPendingTrust} from "@app/policies"
  import {decodeRelay} from "@app/relays"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const url = decodeRelay($page.params.relay!)

  const authError = deriveRelayAuthError(url)

  const showAuthError = once(() =>
    pushModal(SpaceAuthError, {url, error: $authError}, {noEscape: true}),
  )

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
      // Force a fresh fetch rather than `load`, which can resolve immediately from an
      // hour-stale cache and make a space the user has since joined look unjoined.
      // Unlike `load`, `forceLoad` doesn't swallow fetch errors, so catch them here —
      // otherwise a failed fetch would leave spacesLoaded false forever.
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

  // Watch for relay errors and notify the user
  // Direct links skip Discover — prompt to join when relay is not in the user's space list.
  $effect(() => {
    if ($modal) return

    if (redirectUrl && redirectUrl !== url && !redirectPrompted.has(url)) {
      redirectPrompted.add(url)
      pushModal(SpaceRedirect, {url, newUrl: redirectUrl})
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
    {#key $page.url.pathname}
      {@render children?.()}
    {/key}
  </Page>
{/if}
