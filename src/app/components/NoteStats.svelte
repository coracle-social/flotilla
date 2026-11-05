<script lang="ts">
  import {
    call,
    groupBy,
    int,
    max,
    min,
    now,
    removeUndefined,
    sortBy,
    spec,
    sum,
    uniq,
    HOUR,
  } from "@welshman/lib"
  import {fromMsats} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getEmojis} from "@welshman/domain"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import Reaction from "@app/components/Reaction.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {deriveNoteStats} from "@app/features/social/stats"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    event: TrustedEvent
    noun?: string
  }

  const {event, noun = "Note"}: Props = $props()

  const stats = deriveNoteStats(event)

  const comments = $derived($stats.comments)

  const reactions = $derived($stats.reactions)

  const reposts = $derived($stats.reposts)

  const zaps = $derived($stats.zaps)

  // A custom emoji is one reaction per url, so the key it groups by carries the url too.
  const getReactionKey = (event: TrustedEvent) => {
    const shortcode = event.content.replace(/:/g, "")
    const emoji = getEmojis(event).find(spec({shortcode}))

    return emoji ? `emoji${emoji.shortcode}${emoji.url}` : event.content
  }

  const reactionGroups = $derived(
    sortBy(
      group => -group.events.length,
      Array.from(groupBy(getReactionKey, reactions)).map(([key, events]) => ({
        key,
        events,
        pubkeys: uniq(events.map(event => event.pubkey)),
      })),
    ),
  )

  const zappers = $derived(
    sortBy(
      zapper => -zapper.amount,
      Array.from(groupBy(zap => zap.pubkey, zaps)).map(([pubkey, zaps]) => ({
        pubkey,
        amount: fromMsats(sum(zaps.map(zap => zap.msats))),
      })),
    ),
  )

  const zapTotal = $derived(sum(zappers.map(zapper => zapper.amount)))

  const types = $derived(
    removeUndefined([
      {label: "Comments", color: "bg-primary", count: comments.length},
      {label: "Reactions", color: "bg-error", count: reactions.length},
      {label: "Reposts", color: "bg-secondary", count: reposts.length},
      ENABLE_ZAPS ? {label: "Zaps", color: "bg-success", count: zaps.length} : undefined,
    ]),
  )

  const total = $derived(sum(types.map(type => type.count)))

  // Activity clusters at the end for most notes, so the empty run before it is left out.
  const chart = $derived(
    call(() => {
      const activity = [
        ...comments.map(event => ({timestamp: event.created_at, label: "Comments"})),
        ...reactions.map(event => ({timestamp: event.created_at, label: "Reactions"})),
        ...reposts.map(event => ({timestamp: event.created_at, label: "Reposts"})),
        ...zaps.map(zap => ({timestamp: zap.timestamp, label: "Zaps"})),
      ]

      if (activity.length === 0) {
        return []
      }

      const start = min(activity.map(item => item.timestamp))
      const size = max([(now() - start) / 24, int(1, HOUR)])
      const buckets = Array.from({length: 24}, () => new Map<string, number>())

      for (const {timestamp, label} of activity) {
        const index = Math.min(23, Math.floor((timestamp - start) / size))

        buckets[index].set(label, (buckets[index].get(label) ?? 0) + 1)
      }

      return buckets.slice(buckets.findIndex(bucket => bucket.size > 0))
    }),
  )

  const peak = $derived(max(chart.map(bucket => sum(Array.from(bucket.values())))))

  const openProfile = (pubkey: string) => () => pushModal(ProfileDetail, {pubkey})
</script>

{#snippet people(pubkeys: string[])}
  <div class="flex flex-wrap items-center gap-2">
    <ProfileCircles {pubkeys} size={6} limit={6} />
    <div class="flex flex-wrap items-center gap-x-1 text-sm">
      {#each pubkeys as pubkey, i (pubkey)}
        <Button class="link" onclick={openProfile(pubkey)}><ProfileName {pubkey} /></Button
        >{#if i < pubkeys.length - 1}<span>,</span>{/if}
      {/each}
    </div>
  </div>
{/snippet}

<Modal label="{noun} Stats">
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{noun} Stats</ModalTitle>
    </ModalHeader>
    {#if total > 0}
      <div class="flex flex-col gap-3">
        <div aria-hidden="true" class="flex h-24 items-end gap-1 border-b border-line">
          {#each chart as bucket, i (i)}
            <div class="flex h-full flex-1 flex-col-reverse gap-px">
              {#each types as type (type.label)}
                {@const count = bucket.get(type.label) ?? 0}
                {#if count > 0}
                  <div class="{type.color} shrink-0" style="height: {(count / peak) * 100}%"></div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-3 text-xs">
          {#each types as type (type.label)}
            <span class="flex items-center gap-1.5">
              <span class="{type.color} h-2 w-2 rounded-full"></span>
              <span class="opacity-75">{type.count} {type.label.toLowerCase()}</span>
            </span>
          {/each}
        </div>
      </div>
    {:else}
      <p class="text-center text-sm opacity-75">No comments, reactions, reposts or zaps yet.</p>
    {/if}
    {#if comments.length > 0}
      <div class="flex flex-col gap-2">
        <h2 class="text-sm font-bold">Comments</h2>
        {@render people(uniq(comments.map(event => event.pubkey)))}
      </div>
    {/if}
    {#if reactionGroups.length > 0}
      <div class="flex flex-col gap-2">
        <h2 class="text-sm font-bold">Reactions</h2>
        <div class="flex flex-wrap gap-2">
          {#each reactionGroups as group (group.key)}
            <span class="badge badge-neutral gap-1 font-normal">
              <Reaction event={group.events[0]} />
              <span>{group.events.length}</span>
              <ProfileCircles pubkeys={group.pubkeys} size={5} limit={3} />
            </span>
          {/each}
        </div>
      </div>
    {/if}
    {#if reposts.length > 0}
      <div class="flex flex-col gap-2">
        <h2 class="text-sm font-bold">Reposts</h2>
        {@render people(uniq(reposts.map(event => event.pubkey)))}
      </div>
    {/if}
    {#if zappers.length > 0}
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-sm font-bold">Zaps</h2>
          <span class="text-xs opacity-50">{zapTotal.toLocaleString()} sats</span>
        </div>
        {#each zappers as zapper (zapper.pubkey)}
          <div class="flex items-center gap-2 text-sm">
            <ProfileCircle pubkey={zapper.pubkey} size={6} />
            <span class="min-w-0 flex-1 truncate">
              <ProfileName pubkey={zapper.pubkey} />
            </span>
            <span class="shrink-0 font-bold text-primary">
              {zapper.amount.toLocaleString()} sats
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </ModalBody>
</Modal>
