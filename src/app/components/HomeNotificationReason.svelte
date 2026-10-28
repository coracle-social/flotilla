<script lang="ts">
  import type {Snippet} from "svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    icon?: string
    children: Snippet
  }

  const {icon, children}: Props = $props()
</script>

<div class="flex flex-wrap items-center gap-1 text-sm opacity-75">
  {#if icon}
    <Icon {icon} size={4} />
  {/if}
  {@render children()}
</div>
