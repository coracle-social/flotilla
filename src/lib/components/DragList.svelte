<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {flip} from "svelte/animate"
  import {cubicOut} from "svelte/easing"
  import {insertAt, removeAt} from "@welshman/lib"

  type Props = {
    items: string[]
    onReorder: (items: string[]) => void
    item: Snippet<[string]>
    class?: string
    itemClass?: string
    role?: string
    itemRole?: string
  }

  const {
    items,
    onReorder,
    item,
    class: className = "",
    itemClass = "",
    role = undefined,
    itemRole = undefined,
  }: Props = $props()

  const isSameOrder = (a: string[], b: string[]) =>
    a.length === b.length && a.every((item, index) => item === b[index])

  const moveTo = (source: string, target: string) => {
    const from = order.indexOf(source)
    const to = order.indexOf(target)

    if (from >= 0 && to >= 0 && from !== to) {
      preview = insertAt(to, order[from], removeAt(from, order))
    }
  }

  const onDragStart = (e: DragEvent, value: string) => {
    dragged = value
    dropped = false

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const onDragEnter = (e: DragEvent, value: string) => {
    e.preventDefault()

    if (dragged) {
      moveTo(dragged, value)
    }
  }

  const onDrop = (e: DragEvent, value: string) => {
    e.preventDefault()

    if (dragged) {
      moveTo(dragged, value)
    }

    dragged = undefined
    dropped = true

    if (preview) {
      onReorder(preview)
    }
  }

  const onDragEnd = () => {
    if (!dropped) {
      preview = undefined
    }

    dragged = undefined
  }

  let preview = $state<string[] | undefined>()
  let lastItems = $state<string[]>([])
  let dragged = $state<string | undefined>()
  let dropped = $state(false)

  // Reordering is previewed locally, so a drag reads as movement without the caller hearing about
  // every position the item passes through. It hears about it once, on drop.
  const order = $derived(preview ?? items)

  // The preview outlives the drop, since the caller takes a moment to publish the new order, and
  // is dropped as soon as the items it was built from change.
  $effect(() => {
    if (!isSameOrder(items, lastItems)) {
      lastItems = items
      preview = undefined
    }
  })
</script>

<div class={className} {role}>
  {#each order as value (value)}
    <div
      animate:flip={{duration: 300, easing: cubicOut}}
      class={cx("transition-opacity duration-200", itemClass, {"opacity-50": dragged === value})}
      draggable="true"
      role={itemRole}
      ondragstart={e => onDragStart(e, value)}
      ondragover={onDragOver}
      ondragenter={e => onDragEnter(e, value)}
      ondrop={e => onDrop(e, value)}
      ondragend={onDragEnd}>
      {@render item(value)}
    </div>
  {/each}
</div>
