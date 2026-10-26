<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    onclick?: () => void
    className?: string
    children?: Snippet
  }

  const {onclick = () => {}, className = "", children}: Props = $props()
</script>

<div class={cx("absolute bottom-6 right-4 z-nav hide-on-keyboard md:hidden", className)}>
  <Button class="button button-primary button-circle size-[50px]" {onclick}>
    <div class="flex items-center justify-center">
      {@render children?.()}
    </div>
  </Button>
</div>
