<script lang="ts">
  type Props = {
    children?: import("svelte").Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()
</script>

<div class="flex flex-col gap-2 p-2 {props.class}">
  {@render props.children?.()}
</div>
