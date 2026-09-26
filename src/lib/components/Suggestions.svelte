<script lang="ts">
  import type {Component as SvelteComponent} from "svelte"
  import type {Readable} from "svelte/store"
  import {fly} from "svelte/transition"
  import cx from "classnames"
  import {throttle, clamp} from "@welshman/lib"
  import {preventDefault, stopPropagation} from "@lib/html"

  type Props = {
    term: Readable<string>
    search: (term: string) => string[]
    select: (value: string) => void
    component: SvelteComponent<{value: string}>
    style?: string
    allowCreate?: boolean
  }

  const {
    term,
    search,
    select,
    component: Component,
    style = "",
    allowCreate = false,
  }: Props = $props()

  let index = $state(0)
  let items: string[] = $state([])

  const populateItems = throttle(300, (term: string) => {
    items = term ? search(term).slice(0, 5) : []
  })

  const setIndex = (newIndex: number) => {
    index = clamp([0, items.length - 1], newIndex)
  }

  export const onKeyDown = (e: KeyboardEvent) => {
    if (["Enter", "Tab"].includes(e.code)) {
      const value = items[index]

      if (value) {
        select(value)
        return true
      } else if ($term && allowCreate) {
        select($term)
        return true
      }
    }

    if (e.code === "Space" && $term && allowCreate) {
      select($term)
      return true
    }

    if (e.code === "ArrowUp") {
      setIndex(index - 1)

      return true
    }

    if (e.code === "ArrowDown") {
      setIndex(index + 1)

      return true
    }
  }

  const onmousedown = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }

  $effect(() => {
    populateItems($term)
  })
</script>

<div transition:fly|local={{duration: 200}} class="tiptap-suggestions" {style}>
  <div class="tiptap-suggestions__content max-h-[40vh]">
    {#if $term && allowCreate && !items.includes($term)}
      <button
        class="tiptap-suggestions__create"
        {onmousedown}
        onclick={stopPropagation(preventDefault(() => select($term)))}>
        Use "<Component value={$term}></Component>"
      </button>
    {/if}
    {#each items as value, i (value)}
      <button
        aria-label={value}
        class={cx("tiptap-suggestions__item", {"tiptap-suggestions__selected": index === i})}
        {onmousedown}
        onclick={stopPropagation(preventDefault(() => select(value)))}>
        <Component {value}></Component>
      </button>
    {:else}
      <div class="tiptap-suggestions__item">No results</div>
    {/each}
  </div>
</div>
