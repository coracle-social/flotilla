<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children?: Snippet
  }

  const {children}: Props = $props()
</script>

<div class="h-20 flex-shrink-0"></div>
<div class="flex absolute bottom-sai left-0 right-0 p-6 py-4 rounded-b-box bg-base-200">
  <div class="flex flex-grow gap-4 items-center justify-between">
    {@render children?.()}
  </div>
</div>
