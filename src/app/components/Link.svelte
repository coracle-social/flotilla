<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {navigate} from "@app/navigation/navigate"

  type Props = {
    children?: Snippet
    href: string
    external?: boolean
    replaceState?: boolean
    disabled?: boolean
    class?: string
    style?: string
    "data-tip"?: string
    "aria-label"?: string
  }

  const {children, href, external = false, replaceState = false, ...restProps}: Props = $props()

  // A modified click opens a new tab or window, which only the browser can do.
  const isModified = (e: MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

  const onClick = (e: MouseEvent) => {
    e.stopPropagation()

    if (!external && !isModified(e)) {
      e.preventDefault()

      navigate(href, {replaceState})
    }
  }
</script>

<a
  {href}
  {...restProps}
  onclick={onClick}
  class={cx("cursor-pointer", restProps.class)}
  rel={external ? "noopener noreferer" : ""}
  target={external ? "_blank" : ""}>
  {@render children?.()}
</a>
