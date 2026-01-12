<script lang="ts">
  import cx from "classnames"
  import {noop} from "@welshman/lib"
  import {fade, fly} from "@lib/transition"

  interface Props {
    onClose?: any
    fullscreen?: boolean
    children?: import("svelte").Snippet
  }

  const {onClose = noop, fullscreen = false, children}: Props = $props()

  const extraClass = $derived(
    !fullscreen &&
      cx(
        "bg-alt text-base-content overflow-auto text-base-content shadow-md",
        "px-4 py-6 bottom-0 left-0 right-0 top-20 rounded-t-box absolute",
        "sm:p-6 sm:max-h-[90vh] sm:w-[520px] sm:rounded-box sm:relative sm:top-0 sm:relative",
      ),
  )
</script>

<div class="center fixed inset-0 z-modal">
  <button
    aria-label="Close dialog"
    class="absolute inset-0 cursor-pointer bg-[#ccc] opacity-75 dark:bg-black"
    transition:fade={{duration: 300}}
    onclick={onClose}>
  </button>
  <div class="scroll-container z-feature {extraClass}" transition:fly={{duration: 300}}>
    {@render children?.()}
  </div>
</div>
