<script lang="ts">
  import {navigate} from "@app/modal"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {tagValue, tagSpec} from "@welshman/util"
  import ChatRoundDots from "@assets/icons/chat-round-dots.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {makeRoomPath, makeSpaceChatPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    count: number
  }

  const {url, event, count}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)

  const onClick = () => navigate(h ? makeRoomPath(url, h) : makeSpaceChatPath(url))
</script>

<Cv tag={Button} class="card card-interactive" onclick={onClick}>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-sm">
      {#if h}
        <RoomNameWithImage {url} {h} class="font-semibold" />
      {:else}
        <Icon icon={ChatRoundDots} class="h-6 w-6 opacity-50" />
        <span class="truncate font-semibold">Chat</span>
      {/if}
      <span class="ml-auto text-nowrap opacity-50">
        {formatTimestamp(event.created_at)}
      </span>
    </div>
    <div class="flex items-start gap-3">
      <ProfileCircle pubkey={event.pubkey} size={10} />
      <div class="min-w-0 flex-1">
        <NoteContentMinimal {event} />
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="opacity-50">
        {count}
        recent messages{count === 1 ? "" : "s"}
      </span>
      <Button class="button button-primary button-xs button-pill" onclick={onClick}>
        View Conversation
        <Icon icon={AltArrowRight} />
      </Button>
    </div>
  </div>
</Cv>
