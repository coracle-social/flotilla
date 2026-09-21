<script lang="ts">
  // The scroll lives on the page's content element rather than the window, so it's handed in.
  type Props = {
    element?: Element
  }

  const {element}: Props = $props()

  let progress = $state(0)

  $effect(() => {
    if (!element) {
      return
    }

    const target = element

    const update = () => {
      const {scrollTop, scrollHeight, clientHeight} = target as HTMLElement
      const scrollable = scrollHeight - clientHeight

      // A non-scrollable page reads as zero rather than a misleading full bar.
      progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0
    }

    update()

    target.addEventListener("scroll", update, {passive: true})

    // Content (article, then comments) keeps arriving after mount, resizing the scroll range.
    const observer = new ResizeObserver(update)

    observer.observe(target)

    for (const child of target.children) {
      observer.observe(child)
    }

    return () => {
      target.removeEventListener("scroll", update)
      observer.disconnect()
    }
  })
</script>

<div class="bg-line relative h-0.5 w-full shrink-0" aria-hidden="true">
  <div
    class="bg-primary h-full origin-left transition-transform duration-150 ease-out"
    style="transform: scaleX({progress})">
  </div>
</div>
