<script lang="ts">
  import {formatTimestamp, remove, uniq} from "@welshman/lib"
  import ChatRoundDots from "@assets/icons/chat-round-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import UnreadDot from "@app/components/UnreadDot.svelte"
  import {user} from "@app/core"
  import type {InboxConversation} from "@app/inbox"

  type Props = {
    conversation: InboxConversation
  }

  const {conversation}: Props = $props()

  const path = $derived(conversation.path)
  const url = $derived(conversation.url)
  const h = $derived(conversation.h)
  const event = $derived(conversation.event)
  const others = $derived(uniq(remove($user.pubkey, conversation.pubkeys ?? [])))
</script>

<Link href={path} class="card card-sm card-interactive flex flex-col gap-2">
  <div class="flex min-w-0 items-center gap-2 text-sm">
    {#if url}
      <strong class="truncate">
        {#if h}
          <RoomName {url} {h} />
        {:else}
          Chat
        {/if}
      </strong>
      <span class="truncate opacity-50">
        <RelayName {url} />
      </span>
    {:else}
      <Icon icon={ChatRoundDots} size={4} class="shrink-0 opacity-50" />
      <strong class="truncate">
        {#if others.length === 0}
          Note to self
        {:else}
          <ProfileName pubkey={others[0]} />
          {#if others.length > 1}
            and {others.length - 1} {others.length > 2 ? "others" : "other"}
          {/if}
        {/if}
      </strong>
      <span class="truncate opacity-50">direct message</span>
    {/if}
    <span class="ml-auto flex shrink-0 items-center gap-2 text-xs opacity-50">
      {formatTimestamp(event.created_at)}
      <UnreadDot {path} />
    </span>
  </div>
  <div class="flex min-w-0 items-center gap-2">
    <ProfileCircle pubkey={event.pubkey} size={5} />
    <span class="shrink-0 text-xs opacity-50">
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
</Link>
