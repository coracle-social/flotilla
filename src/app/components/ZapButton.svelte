<script lang="ts">
  import type {Snippet} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Zappers} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import {pushModal} from "@app/modal"
  import {app} from "@app/core"

  type Props = {
    url?: string
    event: TrustedEvent
    children: Snippet
    replaceState?: boolean
    class?: string
    "data-tip"?: string
    "aria-label"?: string
  }

  const {url, event, children, replaceState, ...props}: Props = $props()

  const zapperPromise = $app.use(Zappers).loadForPubkey(event.pubkey, removeUndefined([url]))

  const onClick = async () => {
    loading = true

    try {
      const zapper = await zapperPromise

      if (zapper?.allowsNostr) {
        pushModal(Zap, {url, pubkey: event.pubkey, event}, {replaceState})
      } else {
        pushModal(InfoZapperError, {url, pubkey: event.pubkey}, {replaceState})
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
