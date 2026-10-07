<script lang="ts">
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    label: string
    pressed: boolean
    onclick: () => void
    count?: number
    joined?: boolean
    size?: "xs" | "sm"
  }

  const {label, pressed, onclick, count, joined, size = "sm"}: Props = $props()
</script>

<Button
  aria-pressed={pressed}
  class={cx(
    "button",
    {"button-xs": size === "xs", "button-sm": size === "sm"},
    joined ? "join-item grow" : "shrink-0 rounded-full",
    pressed ? "button-primary" : "button-neutral",
  )}
  {onclick}>
  {label}
  {#if count !== undefined}
    <span class="opacity-75">{count}</span>
  {/if}
</Button>
