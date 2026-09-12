<script lang="ts">
  import cx from "classnames"
  import {getContext} from "svelte"
  import type {Snippet} from "svelte"
  import type {DialogContext} from "@lib/components/dialog"
  import {DIALOG_CONTEXT} from "@lib/components/dialog"

  type Props = {
    label?: string
    tag?: string
    class?: string
    children?: Snippet
    [key: string]: any
  }

  const {children, label, tag = "div", ...props}: Props = $props()

  const context = getContext<DialogContext | undefined>(DIALOG_CONTEXT)

  $effect(() => {
    if (label) {
      return context?.registerLabel(label)
    }
  })
</script>

<svelte:element this={tag} {...props} class={cx("flex flex-col overflow-hidden", props.class)}>
  {@render children?.()}
</svelte:element>
