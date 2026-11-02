<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Placement} from "tippy.js"
  import Tippy from "@lib/components/Tippy.svelte"

  type Props = {
    content: string
    children: Snippet
    placement?: Placement
    class?: string
  }

  const {content, children, placement = "top", class: className}: Props = $props()
</script>

{#if content}
  <Tippy class={className} params={{content, placement, theme: "tooltip"}}>
    {@render children()}
  </Tippy>
{:else}
  {@render children()}
{/if}
