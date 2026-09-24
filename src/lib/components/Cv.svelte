<script lang="ts" module>
  import type {Maybe} from "@welshman/lib"

  let instance: Maybe<IntersectionObserver>

  /** Browsers paint a `content-visibility: auto` element within half a viewport, which a fast scroll outruns. */
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
