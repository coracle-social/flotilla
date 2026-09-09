<script lang="ts" module>
  import type {Maybe} from "@welshman/lib"

  let instance: Maybe<IntersectionObserver>

  /** Browsers only paint a `content-visibility: auto` element within half a viewport of the scroll
   * position, which a fast scroll outruns, leaving empty cards behind. There is no css control over
   * that distance, so the element is painted two viewports ahead instead. The observer has to watch
   * the element carrying `cv` — a descendant of one is inside the subtree being skipped, which is
   * why the class and the attachment live in the same component. */
  const renderAhead = (element: HTMLElement) => {
    const observer = (instance ||= new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement

          target.style.contentVisibility = entry.isIntersecting ? "visible" : ""
        }
      },
      {rootMargin: "200% 0px"},
    ))

    observer.observe(element)

    return () => observer.unobserve(element)
  }
</script>

<script lang="ts">
  import type {Component, Snippet} from "svelte"
  import cx from "classnames"

  // The root of anything rendered in a long list. `cv` lets the browser skip an offscreen one,
  // and `renderAhead` is what keeps a fast scroll from outrunning that; `tag` takes whatever the
  // item was already using as its root, so nothing gains a wrapper element and everything else
  // passes through to it.
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
