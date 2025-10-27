<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {session, loadZapperForPubkey} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import {pushModal} from "@app/util/modal"

  type Props = {
    url?: string
    event: TrustedEvent
    children: Snippet
    replaceState?: boolean
    class?: string
  }

  const {url, event, children, replaceState, ...props}: Props = $props()

  const zapperPromise = loadZapperForPubkey(event.pubkey)

  const onClick = async () => {
    loading = true

    try {
      const zapper = await zapperPromise

      if (!zapper?.allowsNostr) {
        pushModal(InfoZapperError, {url, pubkey: event.pubkey, eventId: event.id}, {replaceState})
      } else if ($session?.wallet) {
        pushModal(Zap, {url, pubkey: event.pubkey, eventId: event.id}, {replaceState})
      } else {
        pushModal(WalletConnect, {}, {replaceState})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Button onclick={onClick} disabled={loading} {...props}>
  {@render children?.()}
</Button>
