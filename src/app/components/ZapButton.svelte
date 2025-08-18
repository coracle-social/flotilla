<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {session, deriveZapperForPubkey} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    children: Snippet
    replaceState?: boolean
    class?: string
  }

  const {url, event, children, replaceState, ...props}: Props = $props()

  const zapper = deriveZapperForPubkey(event.pubkey)

  const onClick = () => {
    if (!$zapper?.allowsNostr) {
      pushModal(InfoZapperError, {url, pubkey: event.pubkey, eventId: event.id}, {replaceState})
    } else if ($session?.wallet) {
      pushModal(Zap, {url, pubkey: event.pubkey, eventId: event.id}, {replaceState})
    } else {
      pushModal(WalletConnect, {}, {replaceState})
    }
  }
</script>

<Button onclick={onClick} {...props}>
  {@render children?.()}
</Button>
