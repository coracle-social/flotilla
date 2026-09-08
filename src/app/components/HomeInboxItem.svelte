<script lang="ts">
  import {formatTimestamp, remove, uniq} from "@welshman/lib"
  import Link from "@lib/components/Link.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {user} from "@app/core"
  import type {Activity} from "@app/notifications"

  type Props = {
    conversation: Activity
  }

  const {conversation}: Props = $props()

  const path = $derived(conversation.path)
  const url = $derived(conversation.url)
  const h = $derived(conversation.h)
  const event = $derived(conversation.event)
  const others = $derived(uniq(remove($user.pubkey, conversation.pubkeys ?? [])))
</script>

<Link href={path} class="card card-sm card-interactive flex items-center gap-3">
  {#if url}
    <RelayIcon {url} size={9} class="shrink-0" />
  {:else}
    <ProfileCircle pubkey={others[0] || $user.pubkey} size={9} class="shrink-0" />
  {/if}
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <div class="flex min-w-0 items-baseline gap-2 text-sm">
      <strong class="truncate">
        {#if url}
          {#if h}
            <RoomName {url} {h} />
          {:else}
            Chat
          {/if}
        {:else if others.length === 0}
          Note to self
        {:else}
          <ProfileName pubkey={others[0]} />
          {#if others.length > 1}
            and {others.length - 1} {others.length > 2 ? "others" : "other"}
          {/if}
        {/if}
      </strong>
      <span class="truncate opacity-50">
        {#if url}
          <RelayName {url} />
        {:else}
          direct message
        {/if}
      </span>
    </div>
    <div class="flex min-w-0 items-center gap-1 text-sm opacity-75">
      <span class="shrink-0">
        {#if event.pubkey === $user.pubkey}
          You:
        {:else}
          <ProfileName pubkey={event.pubkey} {url} />:
        {/if}
      </span>
      <div class="min-w-0 flex-1">
        <NoteContentMinimal {event} {url} singleLine />
      </div>
    </div>
  </div>
  <div class="flex shrink-0 items-center gap-2 text-xs opacity-50">
    {formatTimestamp(event.created_at)}
    <UnreadDot {path} />
  </div>
</Link>
