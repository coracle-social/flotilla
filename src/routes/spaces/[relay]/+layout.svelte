<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import {once} from "@welshman/lib"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import {pushModal} from "@app/util/modal"
  import {decodeRelay, relaysPendingTrust} from "@app/core/state"
  import {deriveRelayAuthError} from "@app/core/commands"

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

  // Watch for relay errors and notify the user
  $effect(() => {
    if ($authError) {
      showAuthError()
    } else if ($relaysPendingTrust.includes(url)) {
      showPendingTrust()
    }
  })
</script>

<SecondaryNav>
  <SpaceMenu {url} />
</SecondaryNav>
<Page>
  {#key $page.url.pathname}
    {@render children?.()}
  {/key}
</Page>
