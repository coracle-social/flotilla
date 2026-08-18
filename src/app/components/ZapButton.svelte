<script lang="ts">
  import type {Snippet} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import {ZAP_GOAL} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import ZapInvoice from "@app/components/ZapInvoice.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import {pushModal} from "@app/modal"
  import {app, reader} from "@app/core"
  import {wallet} from "@app/lightning"

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

  const goal = event.kind === ZAP_GOAL ? reader(ZapGoal)(event) : undefined

  const zapperPromise = $app.use(Zappers).loadForPubkey(event.pubkey, removeUndefined([url]))

  const goalRelays = goal?.urls() ?? []

  const onClick = async () => {
    loading = true

    try {
      const zapper = await zapperPromise

      if (!zapper?.allowsNostr) {
        pushModal(InfoZapperError, {url, pubkey: event.pubkey, eventId: event.id}, {replaceState})
      } else if ($wallet) {
        pushModal(Zap, {url, pubkey: event.pubkey, eventId: event.id, goalRelays}, {replaceState})
      } else {
        pushModal(
          ZapInvoice,
          {url, pubkey: event.pubkey, eventId: event.id, goalRelays},
          {replaceState},
        )
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
