<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"

  type Props = {
    class?: string
    visible?: boolean
    children?: Snippet
  }

  const {children, visible = false, ...props}: Props = $props()
</script>

<div class={cx("secondary-nav", visible ? "flex" : "hidden md:flex", props.class)}>
  {@render children?.()}
</div>
