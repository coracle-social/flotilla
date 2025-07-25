<script lang="ts">
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {groupBy, sum, uniq, uniqBy, batch, displayList} from "@welshman/lib"
  import {
    REACTION,
    ZAP_RESPONSE,
    getReplyFilters,
    getEmojiTags,
    getEmojiTag,
    fromMsats,
    getTag,
    REPORT,
    DELETE,
  } from "@welshman/util"
  import type {TrustedEvent, EventContent, Zap} from "@welshman/util"
  import {deriveEvents, deriveEventsMapped} from "@welshman/store"
  import {load} from "@welshman/net"
  import {pubkey, repository, getValidZap, displayProfileByPubkey} from "@welshman/app"
  import {isMobile, preventDefault, stopPropagation} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Reaction from "@app/components/Reaction.svelte"
  import EventReportDetails from "@app/components/EventReportDetails.svelte"
  import {REACTION_KINDS} from "@app/state"
  import {pushModal} from "@app/modal"

  interface Props {
    event: TrustedEvent
    deleteReaction: (event: TrustedEvent) => void
    createReaction: (event: EventContent) => void
    url?: string
    reactionClass?: string
    noTooltip?: boolean
    children?: Snippet
  }

  const {
    event,
    deleteReaction,
    createReaction,
    url = "",
    reactionClass = "",
    noTooltip = false,
    children,
  }: Props = $props()

  const reports = deriveEvents(repository, {
    filters: [{kinds: [REPORT], "#e": [event.id]}],
  })

  const reactions = deriveEvents(repository, {
    filters: [{kinds: [REACTION], "#e": [event.id]}],
  })

  const zaps = deriveEventsMapped<Zap>(repository, {
    filters: [{kinds: [ZAP_RESPONSE], "#e": [event.id]}],
    itemToEvent: item => item.response,
    eventToItem: (response: TrustedEvent) => getValidZap(response, event),
  })

  const onReactionClick = (events: TrustedEvent[]) => {
    const reaction = events.find(e => e.pubkey === $pubkey)

    if (reaction) {
      deleteReaction(reaction)
    } else {
      const [event] = events

      createReaction({
        content: event.content,
        tags: getEmojiTags(event.content.replace(/:/g, ""), event.tags),
      })
    }
  }

  const onReportClick = () => pushModal(EventReportDetails, {url, event})

  const reportReasons = $derived(uniq($reports.map(e => getTag("e", e.tags)?.[2])))

  const getReactionKey = (e: TrustedEvent) => getEmojiTag(e.content, e.tags)?.join("") || e.content

  const groupedReactions = $derived(
    groupBy(
      getReactionKey,
      uniqBy(e => `${e.pubkey}${getReactionKey(e)}`, $reactions),
    ),
  )

  const groupedZaps = $derived(groupBy(e => getReactionKey(e.request), $zaps))

  onMount(() => {
    const controller = new AbortController()

    if (url) {
      load({
        relays: [url],
        signal: controller.signal,
        filters: getReplyFilters([event], {kinds: [REPORT, DELETE, ...REACTION_KINDS]}),
        onEvent: batch(300, (events: TrustedEvent[]) => {
          load({
            relays: [url],
            filters: getReplyFilters(events, {kinds: [DELETE]}),
          })
        }),
      })
    }

    return () => {
      controller.abort()
    }
  })
</script>

{#if $reactions.length > 0 || $zaps.length || $reports.length > 0}
  <div class="flex min-w-0 flex-wrap gap-2">
    {#if url && $reports.length > 0}
      <button
        type="button"
        data-tip={`This content has been reported as "${displayList(reportReasons)}".`}
        class="btn btn-error btn-xs tooltip-right flex items-center gap-1 rounded-full"
        class:tooltip={!noTooltip && !isMobile}
        onclick={stopPropagation(preventDefault(onReportClick))}>
        <Icon icon="danger" />
        <span>{$reports.length}</span>
      </button>
    {/if}
    {#each groupedZaps.entries() as [key, zaps]}
      {@const amount = fromMsats(sum(zaps.map(zap => zap.invoiceAmount)))}
      {@const pubkeys = uniq(zaps.map(zap => zap.request.pubkey))}
      {@const isOwn = $pubkey && pubkeys.includes($pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => displayProfileByPubkey(pubkey)))}
      {@const tooltip = `${info} zapped`}
      <button
        type="button"
        data-tip={tooltip}
        class="flex-inline btn btn-neutral btn-xs gap-1 rounded-full {reactionClass}"
        class:tooltip={!noTooltip && !isMobile}
        class:border={isOwn}
        class:border-solid={isOwn}
        class:border-primary={isOwn}>
        <Reaction event={zaps[0].request} />
        <span>{amount}</span>
      </button>
    {/each}
    {#each groupedReactions.entries() as [key, events]}
      {@const pubkeys = events.map(e => e.pubkey)}
      {@const isOwn = $pubkey && pubkeys.includes($pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => displayProfileByPubkey(pubkey)))}
      {@const tooltip = `${info} reacted`}
      {@const onClick = () => onReactionClick(events)}
      <button
        type="button"
        data-tip={tooltip}
        class="flex-inline btn btn-neutral btn-xs gap-1 rounded-full {reactionClass}"
        class:tooltip={!noTooltip && !isMobile}
        class:border={isOwn}
        class:border-solid={isOwn}
        class:border-primary={isOwn}
        onclick={stopPropagation(preventDefault(onClick))}>
        <Reaction event={events[0]} />
        {#if events.length > 1}
          <span>{events.length}</span>
        {/if}
      </button>
    {/each}
    {@render children?.()}
  </div>
{/if}
