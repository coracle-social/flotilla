<script lang="ts">
  import type {Snippet} from "svelte"
  import {fly} from "svelte/transition"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<div
  in:fly={{y: 60, duration: 250}}
  out:fly={{y: 60, duration: 200}}
  class="relative flex shrink-0 items-center gap-3 border-t border-line bg-surface py-2 pl-4 pr-2 md:pl-6">
  {@render children()}
</div>
