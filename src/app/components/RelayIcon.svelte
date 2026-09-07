<script lang="ts">
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {relays} from "@app/core"
  import {relayIconColor, relayIconInitials} from "@app/relays"

  type Props = {
    url: string
    size?: number
    class?: string
  }

  const {url, size = 7, ...props}: Props = $props()

  const relay = $relays.one(url)

  const rem = $derived(size * 0.25)

  const fallbackStyle = $derived(
    `width: ${rem}rem; height: ${rem}rem; min-width: ${rem}rem; min-height: ${rem}rem; font-size: ${rem * 0.4}rem; background-color: ${relayIconColor(url)}; color: white`,
  )
</script>

{#if $relay?.icon}
  <ImageIcon {size} alt="" src={$relay?.icon} class="rounded-full {props.class}" />
{:else}
  <div
    class="flex select-none items-center justify-center rounded-full font-bold {props.class}"
    style={fallbackStyle}>
    {relayIconInitials(url)}
  </div>
{/if}
