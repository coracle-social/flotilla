<script lang="ts" module>
  const instances = new WeakMap<Element | Document, IntersectionObserver>()

  const paint = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const target = entry.target as HTMLElement

      target.style.contentVisibility = entry.isIntersecting ? "visible" : ""
    }
  }

  /**
   * Browsers paint a `content-visibility: auto` element within half a viewport, which a fast
   * scroll outruns. `rootMargin` grows the root's own box and nothing in between, so an observer
   * watching the viewport is still clipped by the scroll container the list sits in and paints
   * nothing ahead of it — the root has to be that container.
   */
  const renderAhead = (element: HTMLElement) => {
    const root = element.closest(".scroll-container")
    const key = root ?? document
    const observer =
      instances.get(key) ?? new IntersectionObserver(paint, {root, rootMargin: "200% 0px"})

    instances.set(key, observer)
    observer.observe(element)

    return () => observer.unobserve(element)
  }
</script>

<script lang="ts">
  import type {Component, Snippet} from "svelte"
  import cx from "classnames"

  // The root of anything rendered in a long list, where `cv` lets the browser skip an offscreen one.
  type Props = {
    children?: Snippet
    tag?: string | Component<any>
    class?: string
    [key: string]: any
  }

  const {children, tag = "div", ...restProps}: Props = $props()

  const className = $derived(cx("cv", restProps.class))
</script>

{#if typeof tag === "string"}
  <svelte:element this={tag} {...restProps} class={className} {@attach renderAhead}>
    {@render children?.()}
  </svelte:element>
{:else}
  {@const Host = tag}
  <Host {...restProps} class={className} {@attach renderAhead}>
    {@render children?.()}
  </Host>
{/if}
