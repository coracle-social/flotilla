<script lang="ts">
  import cx from "classnames"
  import {formatTimestampAsTime} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import TapTarget from "@lib/components/TapTarget.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import {publishWrappedReaction, retractWrappedReaction} from "@app/reactions"
  import Content from "@app/components/Content.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import PublicationFailure from "@app/components/PublicationFailure.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ChatMessageMenu from "@app/components/ChatMessageMenu.svelte"
  import ChatMessageMenuMobile from "@app/components/ChatMessageMenuMobile.svelte"
  import {profiles, publisher, user} from "@app/core"
  import {noPublications, publicationsByEventId} from "@app/publications"
  import {highlightedEvent} from "@app/routes"
  import {colorFor} from "@app/theme"
  import {pushModal} from "@app/modal"

  type Props = {
    event: TrustedEvent
    replyTo: (event: TrustedEvent) => void
    canEdit?: (event: TrustedEvent) => boolean
    onEdit?: (event: TrustedEvent) => void
    pubkeys: string[]
    showPubkey?: boolean
    context: FeedContext
  }

  const {event, replyTo, canEdit, onEdit, pubkeys, showPubkey = false, context}: Props = $props()

  const isOwn = event.pubkey === $user.pubkey
  const profileDisplay = $profiles.display(event.pubkey).$
  const publication = $derived(
    $publisher.merge($publicationsByEventId.get(event.id) ?? noPublications),
  )
  const colorValue = colorFor(event.pubkey)

  const reply = () => replyTo(event)
  const edit = canEdit?.(event) ? () => onEdit?.(event) : undefined

  const deleteReaction = (reaction: TrustedEvent) => retractWrappedReaction(reaction, pubkeys)

  const createReaction = (values: EventContent) => publishWrappedReaction(event, values, pubkeys)

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey})

  const showMobileMenu = () => pushModal(ChatMessageMenuMobile, {event, pubkeys, reply, edit})

  const togglePopover = () => tippy?.toggle()

  let tippy: Maybe<TippyController> = $state()
</script>

<PublicationFailure showToastOnRetry {publication} class="mt-1" />
<div
  data-event={event.id}
  class={cx("group flex items-center justify-end gap-1 px-2", {
    "flex-row-reverse": !isOwn,
    "highlight-target": $highlightedEvent === event.id,
  })}>
  {#if !isMobile}
    <Tippy
      bind:controller={tippy}
      component={ChatMessageMenu}
      props={{event, pubkeys, tippy, replyTo, edit}}
      params={{interactive: true, trigger: "manual"}}>
      <button
        type="button"
        aria-label="Message actions"
        class="opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
        onclick={togglePopover}>
        <Icon icon={MenuDots} size={4} />
      </button>
    </Tippy>
  {/if}
  <div class={cx("flex min-w-0 flex-col", {"items-end": isOwn})}>
    <TapTarget class={cx("chat-bubble", {"chat-bubble--user": isOwn})} onTap={showMobileMenu}>
      {#if showPubkey}
        <div class="flex items-center gap-2">
          {#if !isOwn}
            <Button onclick={openProfile} class="flex items-center gap-1">
              <ProfileCircle
                pubkey={event.pubkey}
                class="border border-solid border-line"
                size={4} />
              <div class="flex items-center gap-2">
                <Button onclick={openProfile} class="text-sm font-bold" style="color: {colorValue}">
                  {$profileDisplay}
                </Button>
              </div>
            </Button>
          {/if}
          <span class="whitespace-nowrap text-xs opacity-50"
            >{formatTimestampAsTime(event.created_at)}</span>
        </div>
      {/if}
      <div class="text-sm">
        <Content showEntire {event} />
      </div>
    </TapTarget>
    <div class="flex gap-2 z-feature -mt-4 ml-4">
      <ReactionSummary {event} {context} {deleteReaction} {createReaction} noTooltip />
    </div>
  </div>
</div>
