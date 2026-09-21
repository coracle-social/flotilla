<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import type {TrustedEvent} from "@welshman/util"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {fly, slide} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import RoomItemContent from "@app/components/RoomItemContent.svelte"
  import RoomPinnedMessagesAll from "@app/components/RoomPinnedMessagesAll.svelte"
  import {deriveRoomPinnedEvents} from "@app/roomPins"
  import {goToEvent} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const pinnedEvents = deriveRoomPinnedEvents(url, h)

  let currentIndex = $state(0)
  let expanded = $state(false)
  let root: HTMLElement | undefined = $state()

  const total = $derived($pinnedEvents.length)
  const currentEvent = $derived($pinnedEvents[currentIndex])
  const counter = $derived(total > 0 ? `${currentIndex + 1}/${total}` : "")

  const preview = (event: TrustedEvent) => event.content.replace(/\s+/g, " ").trim()

  const formatNpub = (pubkey: string) => {
    const npub = nip19.npubEncode(pubkey)

    return `${npub.slice(0, 10)}...${npub.slice(-5)}`
  }

  const reset = (_url: string, _h: string) => {
    currentIndex = 0
    expanded = false
  }

  const expand = () => {
    expanded = true
  }

  const collapse = () => {
    expanded = false
  }

  const showAll = () => {
    pushModal(RoomPinnedMessagesAll, {url, h})
  }

  const openCounter = () => {
    showAll()
  }

  const prev = () => {
    if (total === 0) {
      return
    }

    currentIndex = (currentIndex - 1 + total) % total
  }

  const next = () => {
    if (total === 0) {
      return
    }

    currentIndex = (currentIndex + 1) % total
  }

  const jumpToMessage = () => {
    if (!currentEvent) {
      return
    }

    collapse()
    goToEvent(currentEvent)
  }

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (!expanded || !root) {
      return
    }

    if (!root.contains(event.target as Node)) {
      collapse()
    }
  }

  $effect(() => {
    reset(url, h)
  })

  $effect(() => {
    if (currentIndex >= $pinnedEvents.length) {
      currentIndex = 0
    }
  })

  $effect(() => {
    if (!expanded) {
      return
    }

    document.addEventListener("pointerdown", onDocumentPointerDown)

    return () => document.removeEventListener("pointerdown", onDocumentPointerDown)
  })
</script>

{#if total > 0 && currentEvent}
  <div class="room-pins-anchor" bind:this={root} in:fly={{y: -16, duration: 250}}>
    <div class="room-pins" class:room-pins--expanded={expanded}>
      <div class="room-pins__header">
        {#if expanded}
          <div class="flex min-w-0 flex-1 items-start gap-3">
            <ProfileCircle pubkey={currentEvent.pubkey} {url} size={6} />
            <div class="min-w-0">
              <p class="room-pins__label">Pinned message</p>
              <p class="text-primary-content/70 truncate text-xs">
                {formatNpub(currentEvent.pubkey)}
              </p>
            </div>
          </div>
        {:else}
          <button type="button" class="room-pins__expand" onclick={expand}>
            <ProfileCircle pubkey={currentEvent.pubkey} {url} size={5} />
            <p class="room-pins__preview">{preview(currentEvent) || "Pinned message"}</p>
          </button>
        {/if}
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
              <button type="button" class="px-1 text-sm" onclick={openCounter}>{counter}</button>
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
