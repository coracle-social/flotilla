<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import {signer, deriveZapperForPubkey} from "@welshman/app"
  import {load} from "@welshman/net"
  import {Router} from "@welshman/router"
  import {requestZap, makeZapRequest, getZapResponseFilter} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import {payInvoice} from "@app/commands"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
    eventId?: string
  }

  const {url, pubkey, eventId}: Props = $props()

  const minPos = 1
  const maxPos = 1000
  const minVal = 21
  const maxVal = 1000000
  const zapperStore = deriveZapperForPubkey(pubkey)

  const posToAmount = (pos: number) => {
    const normalizedPos = (pos - minPos) / (maxPos - minPos)
    const logMin = Math.log(minVal)
    const logMax = Math.log(maxVal)
    const logValue = logMin + normalizedPos * (logMax - logMin)
    return Math.round(Math.exp(logValue))
  }

  const amountToPos = (amount: number) => {
    const clampedAmount = Math.max(minVal, Math.min(maxVal, amount))
    const logMin = Math.log(minVal)
    const logMax = Math.log(maxVal)
    const logValue = Math.log(clampedAmount)
    const normalizedPos = (logValue - logMin) / (logMax - logMin)
    return Math.round(minPos + normalizedPos * (maxPos - minPos))
  }

  const back = () => history.back()

  const onEmoji = (emoji: NativeEmoji) => {
    content = emoji.unicode
  }

  const sendZap = async () => {
    loading = true

    try {
      const zapper = $zapperStore!
      const msats = amount * 1000
      const relays = url ? [url] : Router.get().ForPubkey(pubkey).getUrls()
      const filters = [getZapResponseFilter({zapper, pubkey, eventId})]
      const params = {pubkey, content, eventId, msats, relays, zapper}
      const event = await $signer!.sign(makeZapRequest(params))
      const res = await requestZap({zapper, event})
      console.log({event, zapper, res})

      if (!res.invoice) {
        return pushToast({
          theme: "error",
          message: `Failed to zap: ${res.error || "no error given"}`,
        })
      }

      await payInvoice(res.invoice)
      await load({relays, filters})

      pushToast({message: "Zap successfully sent!"})
      back()
    } catch (e) {
      console.error(e)

      const message = String(e).replace(/^.*Error: /, "")

      pushToast({
        theme: "error",
        message: `Failed to zap: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  let pos = $state(minPos)
  let amount = $state(minVal)
  let content = $state("⚡️")
  let loading = $state(false)

  $effect(() => {
    amount = posToAmount(pos)
  })

  $effect(() => {
    const newPos = amountToPos(amount)
    if (newPos !== pos) {
      pos = newPos
    }
  })
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Send a Zap</div>
    {/snippet}
    {#snippet info()}
      <div>To <ProfileLink {pubkey} class="!text-primary" /></div>
    {/snippet}
  </ModalHeader>
  <FieldInline>
    {#snippet label()}
      Emoji Reaction
    {/snippet}
    {#snippet input()}
      <div class="flex flex-grow items-center justify-end gap-4">
        <EmojiButton {onEmoji} class="btn btn-neutral">
          {content}
        </EmojiButton>
      </div>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      Amount
    {/snippet}
    {#snippet input()}
      <div class="flex flex-grow justify-end">
        <label class="input input-bordered flex items-center gap-2">
          <Icon icon="bolt" />
          <input bind:value={amount} type="number" class="w-24" />
        </label>
      </div>
    {/snippet}
  </FieldInline>
  <input
    class="range range-primary -mt-2"
    type="range"
    min={minPos}
    max={maxPos}
    bind:value={pos} />
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button class="btn btn-primary" onclick={sendZap} disabled={loading}>
      <Spinner {loading}>
        <div class="flex items-center gap-2">
          {#if !loading}
            <Icon icon="bolt" />
          {/if}
          Send Zap
        </div>
      </Spinner>
    </Button>
  </ModalFooter>
</div>
