<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT} from "@welshman/util"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import EventReactButtons from "@app/components/EventReactButtons.svelte"
  import {shareEvent} from "@app/share"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    leading?: Snippet
  }

  const {url, noun, event, leading}: Props = $props()

  const buttonClass = "button button-neutral button-sm rounded-full"

  const isRoot = event.kind !== COMMENT

  const share = () => shareEvent(url, noun, event)
</script>

<div class="flex w-full min-w-0 items-start justify-between gap-x-4">
  <div class="flex min-w-0 grow flex-wrap items-center gap-2">
    <EventReactButtons {url} {event} class="{buttonClass} tip tip-top" />
    {@render leading?.()}
  </div>
  <div class="flex shrink-0 items-center gap-2">
    {#if isRoot}
      <Button aria-label="Share to Chat" class={buttonClass} onclick={share}>
        <Icon icon={ShareCircle} size={4} />
        Share
      </Button>
    {/if}
  </div>
</div>
