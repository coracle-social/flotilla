<script lang="ts" module>
  import type {Maybe} from "@welshman/lib"

  export type TippyController<Content = Record<string, any>> = {
    show: () => void
    hide: () => void
    toggle: () => void
    visible: boolean
    rect: () => Maybe<DOMRect>
    content: Maybe<Content>
  }
</script>

<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import type {Instance} from "tippy.js"
  import {onMount, mount, unmount} from "svelte"
  import {getTippyTarget, isMobile} from "@lib/html"

  let {
    component,
    children = undefined,
    props = {},
    params = {},
    controller = $bindable(),
    ...restProps
  } = $props()

  const target = document.createElement("div")

  // `mount` only tracks prop changes when the props come from a `$state` object,
  // so sync incoming props into a reactive one. Without this the popover keeps
  // the props it was first mounted with, showing stale data after the source updates.
  const mountedProps = $state({...props})

  let element: Element
  let popover: Maybe<Instance>
  let content: Maybe<Record<string, any>>
  let returnFocus: HTMLElement | undefined
  let visible = $state(false)

  // Building a tippy costs a popper element and a set of listeners, which is wasted on the
  // hover menus of a chat row nobody ever opens. Only a real trigger needs the instance up
  // front — tippy is the one listening for it. A manual one can wait to be shown.
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
        content ??= mount(component, {target, props: mountedProps})
        visible = true
        document.addEventListener("keydown", onKeyDown)

        return params.onShow?.(instance)
      },
      onHidden: (instance: Instance) => {
        visible = false
        document.removeEventListener("keydown", onKeyDown)

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
    rect: () => popover?.popper.getBoundingClientRect(),
    get visible() {
      return visible
    },
    get content() {
      return content
    },
  }

  $effect(() => {
    Object.assign(mountedProps, props)
  })

  onMount(() => {
    if (params.trigger !== "manual") {
      create()
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      popover?.destroy()

      if (content) {
        unmount(content)
      }
    }
  })
</script>

<div bind:this={element} class={restProps.class}>
  {@render children?.()}
</div>
