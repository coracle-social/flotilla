<script lang="ts">
  type Props = {
    children?: import("svelte").Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()
</script>

<div data-component="Page" class="page {props.class}">
  {@render props.children?.()}
</div>
