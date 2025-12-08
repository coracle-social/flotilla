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

  const wrapperClass = $derived(
    cx("absolute inset-0 flex sm:relative pointer-events-none", {
      "items-center justify-center": fullscreen,
      "items-end sm:w-[520px] sm:items-center": !fullscreen,
    }),
  )

  const innerClass = $derived(
    cx(
      "relative text-base-content text-base-content flex-grow pointer-events-auto",
      "px-4 py-6 rounded-t-box sm:p-6 sm:rounded-box sm:mt-0",
      {
        "bg-alt shadow-m max-h-[90vh] scroll-container overflow-auto": !fullscreen,
      },
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
  <div class={wrapperClass}>
    <div class={innerClass} transition:fly={{duration: 300}}>
      {@render children?.()}
    </div>
  </div>
</div>
