<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {parse, isEmoji, renderAsHtml} from "@welshman/content"
  import Heart from "@assets/icons/heart-angle.svg?dataurl"
  import ThumbsDown from "@assets/icons/dislike.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentEmoji from "@app/components/ContentEmoji.svelte"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()
</script>

{#if event.content === "+" || event.content === ""}
  <Icon icon={Heart} size={4} />
{:else if event.content === "-"}
  <Icon icon={ThumbsDown} size={4} />
{:else}
  <span class="text-base leading-none">
    {#each parse(event) as parsed, i (i)}
      {#if isEmoji(parsed)}
        <ContentEmoji value={parsed.value} />
      {:else}
        {@html renderAsHtml(parsed)}
      {/if}
    {/each}
  </span>
{/if}
