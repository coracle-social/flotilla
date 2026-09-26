<script lang="ts">
  import type {Snippet} from "svelte"
  import Tippy from "@lib/components/Tippy.svelte"

  type Props = {
    content: string
    children: Snippet
    class?: string
  }

  const {content, children, class: className}: Props = $props()
</script>

<Tippy class={className} params={{content, theme: "tooltip"}}>
  {@render children()}
</Tippy>
