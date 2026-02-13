<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"

  interface Props {
    element?: Element
    children?: Snippet
    [key: string]: any
  }

  let {children, element = $bindable(), ...props}: Props = $props()

  const className = cx(
    props.class,
    "scroll-container cw cb fixed top-[calc(var(--sait)+5rem)] md:top-[calc(var(--sait)+3rem)] z-feature overflow-y-auto overflow-x-hidden",
  )
</script>

<div {...props} bind:this={element} data-component="PageContent" class={className}>
  {@render children?.()}
</div>
