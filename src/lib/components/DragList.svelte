<script lang="ts" generics="T">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {flip} from "svelte/animate"
  import {cubicOut} from "svelte/easing"
  import {equals, insertAt, removeAt} from "@welshman/lib"

  type Props = {
    items: T[]
    getKey: (item: T) => string
    onReorder: (items: T[]) => void
    item: Snippet<[T]>
    class?: string
    itemClass?: string
    role?: string
    itemRole?: string
  }

  const {
    items,
    getKey,
    onReorder,
    item,
    class: className = "",
    itemClass = "",
    role = undefined,
    itemRole = undefined,
  }: Props = $props()

  type Hold = {key: string; target: HTMLElement; pointerId: number; x: number; y: number}

  // A finger has to rest on an item before it picks it up, or a scroll would reorder the list.
  const holdDuration = 250

  // How far a pointer may travel before the gesture is a drag rather than a tap.
  const moveTolerance = 8

  const travelled = (e: PointerEvent) =>
    held ? Math.hypot(e.clientX - held.x, e.clientY - held.y) : 0

  const keyAt = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drag-key]")

    return target && element?.contains(target) ? target.dataset.dragKey : undefined
  }

  const moveTo = (source: string, target: string) => {
    const keys = order.map(getKey)
    const from = keys.indexOf(source)
    const to = keys.indexOf(target)

    if (from >= 0 && to >= 0 && from !== to) {
      preview = insertAt(to, order[from], removeAt(from, order))
    }
  }

  // Scrolling is a touch gesture rather than a default, so refusing it needs a live listener.
  const blockScroll = (e: TouchEvent) => e.preventDefault()

  const startDrag = () => {
    if (held) {
      dragged = held.key

      held.target.setPointerCapture(held.pointerId)
      window.addEventListener("touchmove", blockScroll, {passive: false})
      document.body.style.userSelect = "none"
    }
  }

  const release = () => {
    clearTimeout(timeout)
    window.removeEventListener("touchmove", blockScroll)
    document.body.style.removeProperty("user-select")

    held = undefined
    dragged = undefined
  }

  // A drop lands on whatever is under the pointer, which would otherwise take the click too.
  const swallowClick = () => {
    const swallow = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    window.addEventListener("click", swallow, {capture: true, once: true})
    setTimeout(() => window.removeEventListener("click", swallow, {capture: true}))
  }

  const onPointerDown = (e: PointerEvent, key: string) => {
    const isPrimary = e.pointerType !== "mouse" || e.button === 0

    if (isPrimary && !dragged) {
      held = {
        key,
        target: e.currentTarget as HTMLElement,
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      }

      if (e.pointerType !== "mouse") {
        timeout = setTimeout(startDrag, holdDuration)
      }
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragged && travelled(e) > moveTolerance) {
      // A mouse drags as soon as it moves; a finger that moves before the hold is scrolling.
      if (e.pointerType === "mouse") {
        startDrag()
      } else {
        release()
      }
    }

    if (dragged) {
      const key = keyAt(e.clientX, e.clientY)

      if (key) {
        moveTo(dragged, key)
      }
    }
  }

  // The preview outlives the drop, since the caller takes a moment to publish the new order.
  const onPointerUp = () => {
    if (dragged && preview) {
      onReorder(preview)
      swallowClick()
    }

    release()
  }

  const onPointerCancel = () => {
    preview = undefined

    release()
  }

  let element: HTMLElement | undefined = $state()
  let preview = $state.raw<T[] | undefined>()
  let lastItems = $state.raw<T[]>([])
  let dragged = $state<string | undefined>()
  let held: Hold | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined

  // Reordering is previewed locally, so the caller hears about it once, on drop.
  const order = $derived(preview ?? items)

  $effect(() => {
    if (!equals(items, lastItems)) {
      lastItems = items
      preview = undefined
    }
  })
</script>

<div bind:this={element} class={className} {role}>
  {#each order as value (getKey(value))}
    {@const key = getKey(value)}
    <div
      animate:flip={{duration: 300, easing: cubicOut}}
      class={cx("transition-opacity duration-200", itemClass, {"opacity-50": dragged === key})}
      data-drag-key={key}
      role={itemRole}
      onpointerdown={e => onPointerDown(e, key)}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
      oncontextmenu={e => dragged && e.preventDefault()}>
      {@render item(value)}
    </div>
  {/each}
</div>
