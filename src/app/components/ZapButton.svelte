<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {Zappers} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import Zap from "@app/components/Zap.svelte"
  import InfoZapperError from "@app/components/InfoZapperError.svelte"
  import {pushModal} from "@app/navigation/dialogs"
  import {app} from "@app/core/app"
  import {trackSubmit} from "@app/components/flows/submit"

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

  const {loading, submit: onClick} = trackSubmit(
    () => "Failed to load zap details.",
    async () => {
      // Not on render, since a message can be drawn before its author's profile, and "no lnurl" is final.
      const zapper = await $app.use(Zappers).loadForPubkey(event.pubkey)

      if (zapper?.allowsNostr) {
        pushModal(Zap, {url, pubkey: event.pubkey, event}, {replaceState})
      } else {
        pushModal(InfoZapperError, {pubkey: event.pubkey}, {replaceState})
      }
    },
  )
</script>

<Button onclick={onClick} disabled={$loading} {...props}>
  {@render children?.()}
</Button>
