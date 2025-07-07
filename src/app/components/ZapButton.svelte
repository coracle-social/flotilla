<script lang="ts">
  import {deriveZapperForPubkey} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import {pushModal} from "@app/modal"
  import {wallet} from "@app/state"

  const {url, event, children, ...props} = $props()

  const zapper = deriveZapperForPubkey(event.pubkey)

  const onClick = () => {
    if (!$zapper?.allowsNostr) {
      pushModal(InfoZapperError, {url, pubkey: event.pubkey, eventId: event.id})
    } else if ($wallet) {
      pushModal(Zap, {url, pubkey: event.pubkey, eventId: event.id})
    } else {
      pushModal(WalletConnect)
    }
  }
</script>

<Button onclick={onClick} {...props}>
  {@render children?.()}
</Button>
