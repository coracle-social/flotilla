<style>
  @media (max-width: 450px) {
    emoji-picker {
      --num-columns: 6;
      --category-emoji-size: 1.125rem;
    }
  }
</style>

<script lang="ts">
  import cx from "classnames"
  import "emoji-picker-element"
  import emojiDataUrl from "emoji-picker-element-data/en/emojibase/data.json?url"
  import type {EmojiClickEvent} from "emoji-picker-element/shared"
  import {createSearch} from "@welshman/app"
  import Button from "@lib/components/Button.svelte"
  import {kaomoji} from "@lib/kaomoji"

  type Props = {
    onClick: (emoji: string) => void
    allowKaomoji?: boolean
  }

  const {onClick, allowKaomoji = false}: Props = $props()

  const kaomojiSearch = createSearch(kaomoji, {
    getValue: entry => entry.value,
    fuseOptions: {
      keys: ["name", "keywords"],
      threshold: 0.4,
    },
  })

  const showEmoji = () => {
    showingKaomoji = false
  }

  const showKaomoji = () => {
    showingKaomoji = true
  }

  const onEmojiClick = ({detail}: EmojiClickEvent) => {
    if (detail.unicode) {
      onClick(detail.unicode)
    }
  }

  const listen = (picker: HTMLElementTagNameMap["emoji-picker"]) => {
    picker.addEventListener("emoji-click", onEmojiClick)

    return () => picker.removeEventListener("emoji-click", onEmojiClick)
  }

  let showingKaomoji = $state(false)
  let query = $state("")
</script>

<div data-component="EmojiPicker" class="emoji-picker">
  {#if allowKaomoji}
    <div class="flex gap-1 px-2 pt-2" role="group" aria-label="Emoji or kaomoji">
      <Button
        aria-pressed={!showingKaomoji}
        class={cx("button button-sm rounded-full", {
          "button-primary": !showingKaomoji,
          "button-ghost": showingKaomoji,
        })}
        onclick={showEmoji}>
        Emoji
      </Button>
      <Button
        aria-pressed={showingKaomoji}
        class={cx("button button-sm rounded-full", {
          "button-primary": showingKaomoji,
          "button-ghost": !showingKaomoji,
        })}
        onclick={showKaomoji}>
        Kaomoji
      </Button>
    </div>
  {/if}
  <div class="h-100 max-h-[60vh]">
    {#if showingKaomoji}
      <div class="flex h-full flex-col gap-2 p-2">
        <input
          type="search"
          class="input input-sm"
          placeholder="Search"
          aria-label="Search kaomoji"
          bind:value={query} />
        <div class="grid min-h-0 grow grid-cols-2 content-start gap-1 overflow-y-auto">
          {#each kaomojiSearch.searchOptions(query.trim()) as entry (entry.name)}
            <Button
              class="button button-ghost button-sm h-auto justify-start px-2 py-2 text-left font-normal break-all"
              aria-label={entry.name}
              onclick={() => onClick(entry.value)}>
              {entry.value}
            </Button>
          {/each}
        </div>
      </div>
    {:else}
      <emoji-picker {@attach listen} data-source={emojiDataUrl}></emoji-picker>
    {/if}
  </div>
</div>
