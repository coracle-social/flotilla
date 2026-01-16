<script lang="ts">
  interface Props {
    label?: import("svelte").Snippet
    input?: import("svelte").Snippet
    info?: import("svelte").Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-5 {props.class} items-start">
  <label class="flex items-center gap-2 font-bold lg:col-span-2">
    {@render props.label?.()}
  </label>
  <div class="col-span-2 flex items-center gap-2 lg:col-span-3">
    {@render props.input?.()}
  </div>
  <p class="flex-end text-sm opacity-50 lg:col-span-5">
    {#if props.info}
      {@render props.info?.()}
    {/if}
  </p>
</div>
