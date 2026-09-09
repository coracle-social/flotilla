<script lang="ts">
  import type {Snippet} from "svelte"
  import {fly} from "svelte/transition"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<!-- Only the bottom-most banner has to clear the mobile nav; one stacked above another sits
flush against it instead of leaving the nav's height between them. -->
<div
  in:fly={{y: 60, duration: 250}}
  out:fly={{y: 60, duration: 200}}
  class="relative flex shrink-0 items-center gap-3 border-t border-line bg-surface py-2 pl-4 pr-2 mb-[calc(var(--saib)+3.5rem)] md:mb-[var(--saib)] md:pl-6 [&:not(:last-child)]:mb-0">
  {@render children()}
</div>
