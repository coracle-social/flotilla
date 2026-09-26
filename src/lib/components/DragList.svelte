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

  const moveTo = (source: string, target: string) => {
    const keys = order.map(getKey)
    const from = keys.indexOf(source)
    const to = keys.indexOf(target)

    if (from >= 0 && to >= 0 && from !== to) {
      preview = insertAt(to, order[from], removeAt(from, order))
    }
  }

  const onDragStart = (e: DragEvent, key: string) => {
    dragged = key
    dropped = false

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const onDragEnter = (e: DragEvent, key: string) => {
    e.preventDefault()

    if (dragged) {
      moveTo(dragged, key)
    }
  }

  const onDrop = (e: DragEvent, key: string) => {
    e.preventDefault()

    if (dragged) {
      moveTo(dragged, key)
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

  let preview = $state.raw<T[] | undefined>()
  let lastItems = $state.raw<T[]>([])
  let dragged = $state<string | undefined>()
  let dropped = $state(false)

  // Reordering is previewed locally, so the caller hears about it once, on drop.
  const order = $derived(preview ?? items)

  // The preview outlives the drop, since the caller takes a moment to publish the new order.
  $effect(() => {
    if (!equals(items, lastItems)) {
      lastItems = items
      preview = undefined
    }
  })
</script>

<div class={className} {role}>
  {#each order as value (getKey(value))}
    {@const key = getKey(value)}
    <div
      animate:flip={{duration: 300, easing: cubicOut}}
      class={cx("transition-opacity duration-200", itemClass, {"opacity-50": dragged === key})}
      draggable="true"
      role={itemRole}
      ondragstart={e => onDragStart(e, key)}
      ondragover={onDragOver}
      ondragenter={e => onDragEnter(e, key)}
      ondrop={e => onDrop(e, key)}
      ondragend={onDragEnd}>
      {@render item(value)}
    </div>
  {/each}
</div>
