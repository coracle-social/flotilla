<script lang="ts">
  import cx from "classnames"
  import {derived} from "svelte/store"
  import type {Snippet} from "svelte"
  import {
    displayList,
    filter,
    groupBy,
    map,
    removeUndefined,
    spec,
    sum,
    uniq,
    uniqBy,
  } from "@welshman/lib"
  import {REPORT, REACTION, ZAP_RECEIPT, fromMsats, matchTag, tagSpec} from "@welshman/util"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getEmojis} from "@welshman/domain"
  import type {Zap} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import {isMobile, stopPropagation} from "@lib/html"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Reaction from "@app/components/Reaction.svelte"
  import ReportDetails from "@app/components/ReportDetails.svelte"
  import ProfileList from "@app/components/ProfileList.svelte"
  import ZapModal from "@app/components/Zap.svelte"
  import {app, user} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushModal} from "@app/modal"
  import {deriveDisplaysByPubkey} from "@app/social"

  interface Props {
    event: TrustedEvent
    deleteReaction: (event: TrustedEvent) => void
    createReaction: (event: EventContent) => void
    url?: string
    reactionClass?: string
    noTooltip?: boolean
    innerEvent?: TrustedEvent
    context: FeedContext
    children?: Snippet
  }

  const {
    event,
    deleteReaction,
    createReaction,
    url,
    reactionClass = "",
    noTooltip = false,
    innerEvent = undefined,
    context,
    children,
  }: Props = $props()

  const ownRelated = context.related(event)

  const related = innerEvent
    ? derived([ownRelated, context.related(innerEvent)], ([$own, $inner]) => [...$own, ...$inner])
    : ownRelated

  const reports = derived(ownRelated, $ownRelated => filter(spec({kind: REPORT}), $ownRelated))
  const reactions = derived(related, $related => filter(spec({kind: REACTION}), $related))
  const receipts = derived(related, $related => filter(spec({kind: ZAP_RECEIPT}), $related))

  // A receipt can be a zap of either the event or the one it wraps
  const zaps = derived<typeof receipts, Zap[]>(
    receipts,
    ($receipts, set) =>
      derived(
        removeUndefined([event, innerEvent]).map(
          parent => $app.use(Zappers).validZapReceipts($receipts, parent, removeUndefined([url])).$,
        ),
        (zapsByParent: Zap[][]) => uniqBy(zap => zap.response.id, zapsByParent.flat()),
      ).subscribe(set),
    [],
  )

  const reactorPubkeys = $derived(
    uniq([...$reactions.map(e => e.pubkey), ...$zaps.map(zap => zap.request.pubkey)]),
  )

  const displays = $derived(deriveDisplaysByPubkey(reactorPubkeys, url))

  const toggleReaction = (events: TrustedEvent[]) => {
    const reaction = events.find(spec({pubkey: $user.pubkey}))

    if (reaction) {
      deleteReaction(reaction)
    } else {
      const [event] = events

      const shortcode = event.content.replace(/:/g, "")

      createReaction({
        content: event.content,
        tags: getEmojis(event)
          .filter(spec({shortcode}))
          .map(emoji => ["emoji", emoji.shortcode, emoji.url]),
      })
    }
  }

  const showReactors = (pubkeys: string[], title: string, subtitle: string) =>
    pushModal(ProfileList, {title, subtitle, pubkeys, url})

  const onReactionClick = (events: TrustedEvent[], pubkeys: string[], info: string) => {
    if (isMobile && !pubkeys.includes($user.pubkey)) {
      showReactors(pubkeys, info.replace(" reacted", ""), "Reacted to this message")
    } else {
      toggleReaction(events)
    }
  }

  const onZapClick = (pubkeys: string[], info: string) => {
    if (isMobile) {
      showReactors(pubkeys, info.replace(" zapped", ""), "Zapped this message")
    } else {
      pushModal(ZapModal, {url, pubkey: event.pubkey, event})
    }
  }

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canBanEvent = $derived($supportedMethods.includes("banevent"))

  const onReportClick = () => pushModal(ReportDetails, {url, event})

  const reportReasons = $derived(
    uniq(map(e => matchTag(tagSpec("e"), e.tags)?.[2], $reports.values())),
  )

  const getReactionKey = (e: TrustedEvent) => {
    const shortcode = e.content.replace(/:/g, "")
    const emoji = getEmojis(e).find(spec({shortcode}))

    return emoji ? `emoji${emoji.shortcode}${emoji.url}` : e.content
  }

  const groupedReactions = $derived(
    groupBy(
      getReactionKey,
      uniqBy(e => `${e.pubkey}${getReactionKey(e)}`, $reactions.values()),
    ),
  )

  const groupedZaps = $derived(groupBy(e => getReactionKey(e.request), $zaps.values()))
</script>

{#if $reactions.length > 0 || $zaps.length || $reports.length > 0 || children}
  <div class="flex min-w-0 flex-wrap gap-2">
    {#if url && $reports.length > 0 && canBanEvent}
      <Button
        data-tip={`This content has been reported as "${displayList(reportReasons)}".`}
        class={cx(
          "button button-error button-xs tip-right flex items-center gap-1 rounded-full font-normal",
          {
            tip: !noTooltip && !isMobile,
          },
        )}
        onclick={stopPropagation(onReportClick)}>
        <Icon icon={Danger} />
        <span>{$reports.length}</span>
      </Button>
    {/if}
    {#each groupedZaps.entries() as [key, zaps] (key)}
      {@const amount = fromMsats(sum(zaps.map(zap => zap.invoiceAmount)))}
      {@const pubkeys = uniq(zaps.map(zap => zap.request.pubkey))}
      {@const isOwn = pubkeys.includes($user.pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => $displays.get(pubkey) ?? ""))}
      {@const tooltip = `${info} zapped`}
      {@const onZapClickHandler = () => onZapClick(pubkeys, tooltip)}
      <Button
        data-tip={tooltip}
        class={cx(
          reactionClass,
          "button button-xs flex-inline flex items-center gap-1 rounded-full text-xs font-normal",
          {
            tip: !noTooltip && !isMobile,
            "button-primary": isOwn,
            "button-neutral": !isOwn,
          },
        )}
        onclick={stopPropagation(onZapClickHandler)}>
        <Reaction event={zaps[0].request} />
        <span>{amount}</span>
      </Button>
    {/each}
    {#each groupedReactions.entries() as [key, events] (key)}
      {@const pubkeys = events.map(e => e.pubkey)}
      {@const isOwn = pubkeys.includes($user.pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => $displays.get(pubkey) ?? ""))}
      {@const tooltip = `${info} reacted`}
      {@const onClick = () => onReactionClick(events, pubkeys, info)}
      <Button
        data-tip={tooltip}
        class={cx(reactionClass, "button button-xs flex-inline gap-1 rounded-full font-normal", {
          tip: !noTooltip && !isMobile,
          "button-primary": isOwn,
          "button-neutral": !isOwn,
        })}
        onclick={stopPropagation(onClick)}>
        <Reaction event={events[0]} />
        {#if events.length > 1}
          <span>{events.length}</span>
        {/if}
      </Button>
    {/each}
    {@render children?.()}
  </div>
{/if}
