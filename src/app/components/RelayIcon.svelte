<script lang="ts">
  import {normalizeRelayUrl} from "@welshman/util"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {relays} from "@app/core/plugins"
  import {colorFor} from "@app/features/theme"

  type Props = {
    url: string
    icon?: string
    size?: number
    class?: string
  }

  const {url, icon, size = 7, ...props}: Props = $props()

  const relay = $relays.one(url)

  const src = $derived(icon || $relay?.icon)

  const rem = $derived(size * 0.25)

  const host = $derived(
    normalizeRelayUrl(url)
      .replace(/^wss?:\/\//, "")
      .replace(/[:/].*$/, ""),
  )

  // Darkened so white initials clear 4.5:1 on every color in the palette.
  const color = $derived(`color-mix(in oklab, ${colorFor(host)} 80%, black)`)

  const initials = $derived.by(() => {
    const parts = host.split(".")
    const [first = "", second = ""] = parts

    return (
      parts.length > 2 ? first.slice(0, 1) + second.slice(0, 1) : first.slice(0, 2)
    ).toUpperCase()
  })

  const fallbackStyle = $derived(
    `width: ${rem}rem; height: ${rem}rem; min-width: ${rem}rem; min-height: ${rem}rem; font-size: ${rem * 0.4}rem; background-color: ${color}; color: white`,
  )
</script>

{#if src}
  <ImageIcon {size} {src} alt="" class="rounded-full {props.class}" />
{:else}
  <div
    class="flex select-none items-center justify-center rounded-full font-bold {props.class}"
    style={fallbackStyle}>
    {initials}
  </div>
{/if}
