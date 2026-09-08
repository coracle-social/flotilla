<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {stopPropagation} from "@lib/html"
  import {navigate} from "@app/modal"

  const {
    children,
    href,
    external = false,
    replaceState = false,
    ...restProps
  }: {
    children?: Snippet
    href: string
    external?: boolean
    replaceState?: boolean
    disabled?: boolean
    class?: string
    style?: string
    "data-tip"?: string
    "aria-label"?: string
  } = $props()

  const go = (e: Event) => {
    if (!external) {
      e.preventDefault()

      navigate(href, {replaceState})
    }
  }
</script>

<a
  {href}
  {...restProps}
  onclick={stopPropagation(go)}
  class={cx("cursor-pointer", restProps.class)}
  rel={external ? "noopener noreferer" : ""}
  target={external ? "_blank" : ""}>
  {@render children?.()}
</a>
