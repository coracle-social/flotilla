<script lang="ts">
  import {groupBy, removeUndefined, uniq} from "@welshman/lib"
  import {REACTION, ZAP_RECEIPT, sortEventsDesc, tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Reply from "@assets/icons/reply.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import HomeNetworkReason from "@app/components/HomeNetworkReason.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import Reaction from "@app/components/Reaction.svelte"
  import {REPOST_KINDS} from "@app/content"
  import {user} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {pushModal} from "@app/modal"
  import {pushEventNote} from "@app/routes"
  import {deriveDisplaysByPubkey, notes} from "@app/social"
  import type {HomeNotification} from "@app/social"

  type Props = {
    notification: HomeNotification
    context: FeedContext
  }

  const {notification, context}: Props = $props()

  const {ref, replies, reactions: interactions} = notification

  // The note this entry is about, fetched from the hints the notifications naming it carried.
  const note = $notes.deriveEvent({id: ref.id, author: ref.author, relays: ref.relays})

  const reactions = $derived(interactions.filter(e => e.kind === REACTION))

  const reposts = $derived(interactions.filter(e => REPOST_KINDS.includes(e.kind)))

  // A zap receipt is signed by the lnurl server, so the zapper is in the `P` tag.
  const zappers = $derived(
    uniq(
      removeUndefined(
        interactions.filter(e => e.kind === ZAP_RECEIPT).map(e => tagValue(tagSpec("P"), e.tags)),
      ),
    ),
  )

  const repliers = $derived(uniq(replies.map(e => e.pubkey)))

  const reactors = $derived(uniq(reactions.map(e => e.pubkey)))

  const reposters = $derived(uniq(reposts.map(e => e.pubkey)))

  const displays = $derived(
    deriveDisplaysByPubkey(
      uniq(removeUndefined([...repliers, ...reactors, ...reposters, ...zappers, $note?.pubkey])),
    ),
  )

  const reactionGroups = $derived(groupBy(e => e.content, reactions))

  // A note nobody answered or reacted to is in the feed because it names the user.
  const mention = $derived(replies.length === 0 && interactions.length === 0)

  const reasons = $derived(
    removeUndefined([
      mention ? "mention" : undefined,
      repliers.length > 0 ? "replies" : undefined,
      reactors.length > 0 ? "reactions" : undefined,
      reposters.length > 0 ? "reposts" : undefined,
      zappers.length > 0 ? "zaps" : undefined,
    ]),
  )

  let showEvery = $state(false)

  const sorted = $derived(sortEventsDesc(replies))

  const shown = $derived(showEvery ? sorted : sorted.slice(0, 3))

  // Follows the name at index i, so no whitespace lands before a comma.
  const conjunction = (pubkeys: string[], i: number) => {
    if (pubkeys.length > 4) {
      return i === 0 ? ", " : `, and ${pubkeys.length - 2} others`
    } else if (i === pubkeys.length - 2) {
      return pubkeys.length > 2 ? ", and " : " and "
    } else if (i < pubkeys.length - 2) {
      return ", "
    } else {
      return ""
    }
  }

  const openProfile = (pubkey: string) => () => pushModal(ProfileDetail, {pubkey})

  const openReply = (reply: TrustedEvent) => () => pushEventNote(reply)

  const showAll = () => {
    showEvery = true
  }
</script>

{#snippet names(pubkeys: string[])}
  <span>
    {#each pubkeys.length > 4 ? pubkeys.slice(0, 2) : pubkeys as pubkey, i (pubkey)}
      <Button class="link" onclick={openProfile(pubkey)}>{$displays.get(pubkey)}</Button
      >{conjunction(pubkeys, i)}
    {/each}
  </span>
{/snippet}

{#snippet separator(reason: string)}
  {#if reasons[0] !== reason}
    <span class="text-sm opacity-75">&bull;</span>
  {/if}
{/snippet}

{#if $note}
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-center gap-1 px-1">
      {#if mention}
        {@render separator("mention")}
        <HomeNetworkReason>
          {@render names([$note.pubkey])} mentioned you
        </HomeNetworkReason>
      {/if}
      {#if repliers.length > 0}
        {@render separator("replies")}
        <HomeNetworkReason icon={Reply}>
          {#if $note.pubkey === $user.pubkey}
            {@render names(repliers)} replied to your note
          {:else}
            {@render names(repliers)} replied to a thread you are in
          {/if}
        </HomeNetworkReason>
      {/if}
      {#if reactors.length > 0}
        {@render separator("reactions")}
        <HomeNetworkReason>
          {#if reactionGroups.size === 1}
            {@render names(reactors)} reacted with
            <Reaction event={reactions[0]} />
          {:else}
            {@render names(reactors)} reacted with
            {#each reactionGroups.entries() as [content, group] (content)}
              <span class="badge badge-neutral gap-1 font-normal">
                <Reaction event={group[0]} />
                <ProfileCircles pubkeys={uniq(group.map(e => e.pubkey))} size={5} limit={3} />
              </span>
            {/each}
          {/if}
        </HomeNetworkReason>
      {/if}
      {#if reposters.length > 0}
        {@render separator("reposts")}
        <HomeNetworkReason>
          {@render names(reposters)} reposted this
        </HomeNetworkReason>
      {/if}
      {#if zappers.length > 0}
        {@render separator("zaps")}
        <HomeNetworkReason icon={Bolt}>
          {@render names(zappers)} zapped this
        </HomeNetworkReason>
      {/if}
    </div>
    <NoteItem event={$note} {context} showReply showThreadLinks />
    {#if shown.length > 0}
      <div class="border-line-less ml-4 flex flex-col gap-3 border-l pt-3 pl-4">
        {#each shown as reply (reply.id)}
          <NoteItem
            event={reply}
            {context}
            card={false}
            interactive
            showReply
            onOpen={openReply(reply)} />
        {/each}
        {#if shown.length < replies.length}
          <Button class="link self-start text-sm" onclick={showAll}>
            Show {replies.length - shown.length} more
          </Button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
