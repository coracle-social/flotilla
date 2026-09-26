<script lang="ts">
  import type {Snippet} from "svelte"

  // Behavior only, so the same `button*` classes apply to <a> and <span> without a prop API.
  type Props = {
    children: Snippet
    onclick?: (event: Event) => unknown
    type?: "button" | "submit"
    class?: string
    style?: string
    disabled?: boolean
    "data-tip"?: string
    "aria-label"?: string
    "aria-pressed"?: boolean
  }

  const {children, onclick, type = "button", ...restProps}: Props = $props()

  const onClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    onclick?.(e)
  }
</script>

{#if type === "submit"}
  <button {...restProps} {type}>
    {@render children?.()}
  </button>
{:else}
  <button {...restProps} onclick={onClick} type="button">
    {@render children?.()}
  </button>
{/if}
