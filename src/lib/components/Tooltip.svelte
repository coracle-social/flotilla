<style>
  :global(.tippy-box[data-theme~="tooltip"]) {
    background-color: var(--neutral);
    color: var(--neutral-content);
    border-radius: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="top"] > .tippy-arrow::before) {
    border-top-color: var(--neutral);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="bottom"] > .tippy-arrow::before) {
    border-bottom-color: var(--neutral);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="left"] > .tippy-arrow::before) {
    border-left-color: var(--neutral);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="right"] > .tippy-arrow::before) {
    border-right-color: var(--neutral);
  }
</style>

<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import {onMount} from "svelte"
  import {isMobile} from "@lib/html"

  let {
    content,
    arrow = true,
    interactive = false,
    children = undefined,
    instance = $bindable(),
    ...restProps
  } = $props()

  let element: Element

  onMount(() => {
    instance = tippy(element, {
      content,
      arrow,
      interactive,
      animation: "shift-away",
      theme: "tooltip",
      appendTo: document.querySelector(".tippy-target")!,
      trigger: isMobile ? "click" : "mouseenter focus",
    })

    return () => {
      instance?.destroy()
    }
  })
</script>

<div bind:this={element} class={restProps.class}>
  {@render children?.()}
</div>
