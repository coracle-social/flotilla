<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"

  type Props = {
    class?: string
    children?: Snippet
  }

  const {children, ...props}: Props = $props()
</script>

<div class={cx("scroll-container overflow-y-auto min-h-0 flex flex-col gap-4 p-6", props.class)}>
  {@render children?.()}
</div>
