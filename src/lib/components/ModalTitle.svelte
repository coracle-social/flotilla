<script lang="ts">
  import {getContext} from "svelte"
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {randomId} from "@welshman/lib"
  import type {DialogContext} from "@lib/components/dialog"
  import {DIALOG_CONTEXT} from "@lib/components/dialog"

  type Props = {
    class?: string
    children: Snippet
  }

  const {children, ...props}: Props = $props()

  const id = randomId()
  const context = getContext<DialogContext | undefined>(DIALOG_CONTEXT)

  $effect(() => context?.registerTitle(id))
</script>

<h1 {id} class={cx("heading", props.class)} tabindex="-1">{@render children()}</h1>
