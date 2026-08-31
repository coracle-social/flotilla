<script lang="ts" module>
  export type VirtualListController = {
    // Render a row that isn't on screen yet, so the caller can then find it in the DOM
    reveal: (key: string) => void
  }
</script>

<script lang="ts" generics="T">
  import type {Snippet} from "svelte"
  import type {Maybe} from "@welshman/lib"

  type Props = {
    items: T[]
    getKey: (item: T) => string
    // The scrolling ancestor these rows are laid out in
    container?: HTMLElement
    // Rows to add each time the end of what's rendered comes into reach
    chunk?: number
    // How close to that end the viewport has to get before more are added
    threshold?: number
    controller?: VirtualListController
    row: Snippet<[T]>
  }

  let {
    items,
    getKey,
    container,
    chunk = 40,
    threshold = 2000,
    controller = $bindable(),
    row,
  }: Props = $props()

  // Rows are only ever added — never removed, never stood in for by a spacer, never assigned a
  // guessed height. Everything on screen is real, so the scrollbar is honest and nothing the
  // reader is looking at can shift under them. Guessing at the height of rows that have never
  // been mounted is what makes a virtualised list lurch, and a list that only grows never has to.
  let edgeKey: Maybe<string> = $state()

  // Held by key rather than index: messages arriving at the origin shift every index along, and
  // a window pinned to a number would slide off the rows already on screen.
  const mounted = $derived.by(() => {
    const index = edgeKey ? items.findIndex(item => getKey(item) === edgeKey) : -1

    return index > -1 ? index + 1 : Math.min(chunk, items.length)
  })

  const visible = $derived(items.slice(0, mounted))

  const grow = () => {
    const next = Math.min(items.length, mounted + chunk)

    if (next > mounted) {
      edgeKey = getKey(items[next - 1])
    }
  }

  // Distance left between the viewport and the end of what's rendered. Measured off the
  // container rather than modelled, so anything else the caller puts in there — a spinner, an
  // end-of-history notice — is simply part of it.
  const fill = () => {
    if (container && mounted < items.length) {
      const scrolled = Math.abs(container.scrollTop)
      const remaining = container.scrollHeight - container.clientHeight - scrolled

      if (remaining < threshold) {
        grow()
      }
    }
  }

  controller = {
    reveal: (key: string) => {
      const index = items.findIndex(item => getKey(item) === key)

      if (index >= mounted) {
        edgeKey = getKey(items[index])
      }
    },
  }

  // One growth step may still not reach the threshold, so check again once it has rendered
  $effect(() => {
    if (items.length > mounted) {
      const frame = requestAnimationFrame(fill)

      return () => cancelAnimationFrame(frame)
    }
  })

  $effect(() => {
    if (container) {
      container.addEventListener("scroll", fill, {passive: true})

      return () => container.removeEventListener("scroll", fill)
    }
  })
</script>

{#each visible as item (getKey(item))}
  {@render row(item)}
{/each}
