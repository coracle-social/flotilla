import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {sortBy} from "@welshman/lib"

// Every change sorts the whole list, so an item that arrives late goes where it belongs.
export const strictOrder = <T>(items: Readable<T[]>, compare: (a: T, b: T) => number) =>
  derived(items, $items => [...$items].sort(compare))

// An item keeps the place it was first shown in, so the list never reflows above what the reader sees.
export const appendOnly = <T>(
  items: Readable<T[]>,
  getKey: (item: T) => string,
  getTimestamp: (item: T) => number,
  ceiling: number,
) => {
  let shown: string[] = []

  return derived(items, $items => {
    const itemsByKey = new Map($items.map(item => [getKey(item), item]))
    const kept = shown.filter(key => itemsByKey.has(key))
    const keptKeys = new Set(kept)
    // Each new batch goes after what's shown, newest first, and nothing newer than the feed's start is added.
    const added = sortBy(
      item => -getTimestamp(item),
      $items.filter(item => !keptKeys.has(getKey(item)) && getTimestamp(item) <= ceiling),
    )

    shown = [...kept, ...added.map(getKey)]

    return shown.flatMap(key => itemsByKey.get(key) ?? [])
  })
}
