<script lang="ts">
  import type {Snippet} from "svelte"
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep, once} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {SocketStatus} from "@welshman/net"
  import Page from "@lib/components/Page.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import MenuSpace from "@app/components/MenuSpace.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {
    decodeRelay,
    deriveRelayAuthError,
    relaysPendingTrust,
    deriveSocket,
  } from "@app/core/state"
  import {notifications} from "@app/util/notifications"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const url = decodeRelay($page.params.relay!)

  const socket = deriveSocket(url)

  const authError = deriveRelayAuthError(url)

  const showAuthError = once(() => pushModal(SpaceAuthError, {url, error: $authError}))

  // We have to watch this one, since on mobile the badge will be visible when active
  $effect(() => {
    if ($notifications.has($page.url.pathname)) {
      setChecked($page.url.pathname)
    }
  })

  // Watch for relay errors and notify the user
  $effect(() => {
    if ($authError) {
      showAuthError()
    }
  })

  onMount(() => {
    sleep(2000).then(() => {
      if ($socket.status !== SocketStatus.Open) {
        pushToast({
          theme: "error",
          message: `Failed to connect to ${displayRelayUrl(url)}`,
        })
      }
    })
  })
</script>

<SecondaryNav>
  <MenuSpace {url} />
</SecondaryNav>
<Page>
  {#key $page.url.pathname}
    {@render children?.()}
  {/key}
</Page>

{#if $relaysPendingTrust.includes(url)}
  <Dialog>
    <SpaceTrustRelay {url} />
  </Dialog>
{/if}
