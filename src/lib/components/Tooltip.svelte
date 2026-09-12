<style>
  :global(.tippy-box[data-theme~="tooltip"]) {
    background-color: var(--content);
    color: var(--surface);
    border-radius: var(--radius-xl);
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    box-shadow: var(--shadow);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="top"] > .tippy-arrow::before) {
    border-top-color: var(--content);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="bottom"] > .tippy-arrow::before) {
    border-bottom-color: var(--content);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="left"] > .tippy-arrow::before) {
    border-left-color: var(--content);
  }

  :global(.tippy-box[data-theme~="tooltip"][data-placement^="right"] > .tippy-arrow::before) {
    border-right-color: var(--content);
  }
</style>

<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import {onMount} from "svelte"
  import {getTippyTarget, isMobile} from "@lib/html"

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
      appendTo: getTippyTarget(element),
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
