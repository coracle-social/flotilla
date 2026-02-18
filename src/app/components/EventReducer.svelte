<script lang="ts">
  import {insertAt, lt, addToMapKey, parseJson} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Router, addMaximalFallbacks} from "@welshman/router"
  import {load} from "@welshman/net"
  import {
    getIdOrAddress,
    getIdFilters,
    getParentIdsAndAddrs,
    getParentIdOrAddr,
    verifyEvent,
    ZAP_RESPONSE,
  } from "@welshman/util"
  import {repository, getValidZap} from "@welshman/app"
  import {REPOST_KINDS, REACTION_KINDS, isEventMuted} from '@app/core/state'

  export let events: TrustedEvent[]
  export let depth = 0
  export let showMuted = false
  export let hideReplies = false
  export let showDeleted = false
  export let shouldSort = false
  export let shouldAwait = false
  export let items: TrustedEvent[] = []

  const timestamps = new Map<string, number>()
  const context = new Map<string, Set<TrustedEvent>>()

  const shouldSkip = (event: TrustedEvent) => {
    if (!showMuted && $isEventMuted(event)) return true
    if (!showDeleted && repository.isDeleted(event)) return true
    if (hideReplies && getParentIdOrAddr(event)) return true
    if (timestamps.has(getIdOrAddress(event))) return true

    return false
  }

  const getParent = async (event: TrustedEvent) => {
    if (REPOST_KINDS.includes(event.kind)) {
      const parent = parseJson(event.content)

      if (parent && verifyEvent(parent)) {
        return parent
      }
    }

    const parentIds = getParentIdsAndAddrs(event)

    if (parentIds.length > 0) {
      const filters = getIdFilters(parentIds)
      const [cached] = repository.query(filters)

      if (cached) return cached

      const relays = Router.get().EventParents(event).policy(addMaximalFallbacks).getUrls()
      const [parent] = await load({filters, relays})

      return parent
    }
  }

  const addEvent = async (event: TrustedEvent) => {
    const original = event
    let currentDepth = depth

    timestamps.set(getIdOrAddress(event), original.created_at)

    while (currentDepth > 0) {
      const parent = await getParent(event)

      // Unable to get the parent? we're done traversing parents
      if (!parent) {
        break
      }

      // Skip zaps that fail our zapper check
      if (event.kind === ZAP_RESPONSE && !(await getValidZap(event, parent))) {
        return
      }

      // Link the events, even if we end up skipping this one (since we deduplicate)
      addToMapKey(context, getIdOrAddress(parent), event)

      // Hide replies to deleted/muted parents, or parents we've already seen
      if (shouldSkip(parent)) {
        return
      }

      timestamps.set(getIdOrAddress(parent), original.created_at)
      currentDepth--
      event = parent
    }

    // If it's not displayable, skip it
    if ([...REPOST_KINDS, ...REACTION_KINDS].includes(event.kind)) return

    let inserted = false

    if (shouldSort) {
      for (let i = 0; i < items.length; i++) {
        if (lt(timestamps.get(getIdOrAddress(items[i])), original.created_at)) {
          items = insertAt(i, event, items)
          inserted = true
          break
        }
      }
    }

    if (!inserted) {
      items = [...items, event]
    }
  }

  const addEvents = async (events: TrustedEvent[]) => {
    for (const event of events) {
      if (!shouldSkip(event)) {
        const promise = addEvent(event)

        if (shouldAwait) {
          await promise
        }
      }
    }
  }

  $: addEvents(events)
</script>

{#each items as event, i (event.id)}
  {@render children({i, event})}
{/each}
