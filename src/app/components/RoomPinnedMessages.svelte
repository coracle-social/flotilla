<script lang="ts">
  import cx from "classnames"
  import type {TrustedEvent} from "@welshman/util"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {fly, slide} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RoomItemContent from "@app/components/RoomItemContent.svelte"
  import RoomPinnedMessagesAll from "@app/components/RoomPinnedMessagesAll.svelte"
  import {deriveRoomPinnedEvents} from "@app/features/roomPins"
  import {goToEvent} from "@app/ui/routes"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const pinnedEvents = deriveRoomPinnedEvents(url, h)

  let currentIndex = $state(0)

  const total = $derived($pinnedEvents.length)
  const currentEvent = $derived($pinnedEvents[currentIndex])
  const counter = $derived(`${currentIndex + 1}/${total}`)

  const preview = (event: TrustedEvent) => event.content.replace(/\s+/g, " ").trim()

  const expand = () => {
    expanded = true
  }

  const collapse = () => {
    expanded = false
  }

  const showAll = () => pushModal(RoomPinnedMessagesAll, {url, h})

  const prev = () => {
    currentIndex = (currentIndex - 1 + total) % total
  }

  const next = () => {
    currentIndex = (currentIndex + 1) % total
  }

  const jumpToMessage = () => {
    collapse()
    goToEvent(currentEvent)
  }

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && !root?.contains(event.target)) {
      collapse()
    }
  }

  let expanded = $state(false)
  let root: HTMLElement | undefined = $state()

  $effect(() => {
    if (currentIndex >= total) {
      currentIndex = 0
    }
  })

  $effect(() => {
    if (expanded) {
      document.addEventListener("pointerdown", onDocumentPointerDown)

      return () => document.removeEventListener("pointerdown", onDocumentPointerDown)
    }
  })
</script>

{#if currentEvent}
  <div class="room-pins-anchor" bind:this={root} in:fly={{y: -16, duration: 250}}>
    <div class={cx("room-pins", {"room-pins--expanded": expanded})}>
      <div class="room-pins__header">
        {#key currentEvent.pubkey}
          {#if expanded}
            <div class="flex min-w-0 flex-1 items-start gap-3">
              <ProfileCircle pubkey={currentEvent.pubkey} {url} size={6} />
              <div class="min-w-0">
                <p class="room-pins__label">Pinned message</p>
                <p class="text-primary-content/70 truncate text-xs">
                  <ProfileName pubkey={currentEvent.pubkey} {url} />
                </p>
              </div>
            </div>
          {:else}
            <button type="button" class="room-pins__expand" onclick={expand}>
              <ProfileCircle pubkey={currentEvent.pubkey} {url} size={5} />
              <p class="room-pins__preview">{preview(currentEvent) || "Pinned message"}</p>
            </button>
          {/if}
        {/key}
        <div class="room-pins__counter">
          <Button
            class="button button-ghost button-sm gap-1 text-primary-content"
            aria-label="All pinned messages"
            onclick={showAll}>
            <Icon icon={Pin} size={4} />
            <span class="text-xs">{counter}</span>
          </Button>
        </div>
      </div>
      {#if expanded}
        <div class="room-pins__details" transition:slide={{duration: 200}}>
          <div class="room-pins__message">
            {#key currentEvent.id}
              <RoomItemContent {url} event={currentEvent} />
            {/key}
          </div>
          <div class="room-pins__footer">
            <div class="room-pins__nav">
              {#if total > 1}
                <Button
                  class="button button-ghost button-sm button-square text-primary-content"
                  aria-label="Previous pinned message"
                  onclick={prev}>
                  <Icon icon={AltArrowLeft} size={4} />
                </Button>
              {/if}
              <button type="button" class="px-1 text-sm" onclick={showAll}>{counter}</button>
              {#if total > 1}
                <Button
                  class="button button-ghost button-sm button-square text-primary-content"
                  aria-label="Next pinned message"
                  onclick={next}>
                  <Icon icon={AltArrowRight} size={4} />
                </Button>
              {/if}
            </div>
            <Button
              class="button button-sm border-0 bg-primary-content font-medium text-primary"
              onclick={jumpToMessage}>
              Jump to message
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
