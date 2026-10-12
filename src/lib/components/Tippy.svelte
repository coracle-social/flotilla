<script lang="ts" module>
  import type {Maybe} from "@welshman/lib"

  export type TippyController<Content = Record<string, any>> = {
    show: () => void
    hide: () => void
    toggle: () => void
    visible: boolean
    content: Maybe<Content>
  }

  // Cached because a couple of popovers per chat row runs this thousands of times.
  let tippyTarget: Maybe<Element>

  const getTippyTarget = (trigger: Element) => {
    const dialogTarget = trigger.closest(".dialog-overlay")?.querySelector(".dialog-tippy-target")

    if (dialogTarget) {
      return dialogTarget
    }

    if (!tippyTarget?.isConnected) {
      tippyTarget = document.querySelector(".tippy-target")!
    }

    return tippyTarget
  }
</script>

<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import type {Instance, Props as TippyProps} from "tippy.js"
  import {onMount, mount, unmount} from "svelte"
  import type {Component, Snippet} from "svelte"
  import {between, throttle} from "@welshman/lib"
  import {isMobile} from "@lib/html"

  type Props = {
    component?: Component<any>
    children?: Snippet
    props?: Record<string, any>
    params?: Partial<TippyProps>
    strayMargin?: number
    controller?: TippyController
    class?: string
  }

  let {
    component,
    children,
    props = {},
    params = {},
    strayMargin,
    controller = $bindable(),
    class: className,
  }: Props = $props()

  const target = document.createElement("div")

  // `mount` only tracks prop changes when the props come from a `$state` object.
  const mountedProps = $state({...props})

  let element: Element
  let popover: Maybe<Instance>
  let content: Maybe<Record<string, any>>
  let returnFocus: HTMLElement | undefined
  let visible = $state(false)

  // A popper element and its listeners are wasted on a hover menu nobody opens.
  const create = () => {
    popover ??= tippy(element, {
      content: target,
      animation: "shift-away",
      appendTo: getTippyTarget(element),
      trigger: isMobile ? "click" : "mouseenter focus",
      ...params,
      onShow: (instance: Instance) => {
        const focused = document.activeElement

        returnFocus =
          focused instanceof HTMLElement && element.contains(focused)
            ? focused
            : element.closest<HTMLElement>("button, [href], input, [tabindex]") ||
              element.querySelector<HTMLElement>("button, [href], input, [tabindex]") ||
              undefined

        if (component) {
          content ??= mount(component, {target, props: mountedProps})
        }

        visible = true
        document.addEventListener("keydown", onKeyDown)

        if (strayMargin) {
          document.addEventListener("mousemove", onMouseMove)
        }

        return params.onShow?.(instance)
      },
      // At hide rather than hidden, so a click mid-fade reopens instead of toggling closed.
      onHide: (instance: Instance) => {
        visible = false

        return params.onHide?.(instance)
      },
      onHidden: (instance: Instance) => {
        document.removeEventListener("keydown", onKeyDown)
        document.removeEventListener("mousemove", onMouseMove)

        return params.onHidden?.(instance)
      },
    })

    return popover
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && visible) {
      event.preventDefault()
      event.stopImmediatePropagation()
      popover?.hide()

      if (returnFocus?.isConnected) {
        returnFocus.focus()
      }
    }
  }

  const onMouseMove = throttle(300, ({clientX, clientY}: MouseEvent) => {
    const rect = popover?.popper.getBoundingClientRect()

    if (rect && strayMargin) {
      const {x, y, width, height} = rect
      const inX = between([x - strayMargin, x + width + strayMargin], clientX)
      const inY = between([y - strayMargin, y + height + strayMargin], clientY)

      if (!inX || !inY) {
        popover?.hide()
      }
    }
  })

  controller = {
    show: () => create().show(),
    hide: () => popover?.hide(),
    toggle: () => {
      if (visible) {
        popover?.hide()
      } else {
        create().show()
      }
    },
    get visible() {
      return visible
    },
    get content() {
      return content
    },
  }

  const text = $derived(typeof params.content === "string" ? params.content : undefined)

  $effect(() => {
    Object.assign(mountedProps, props)
  })

  $effect(() => {
    if (text !== undefined) {
      popover?.setContent(text)
    }
  })

  onMount(() => {
    if (params.trigger !== "manual") {
      create()
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousemove", onMouseMove)
      popover?.destroy()

      if (content) {
        unmount(content)
      }
    }
  })
</script>

<div bind:this={element} class={className}>
  {@render children?.()}
</div>
