<script lang="ts">
  import {onDestroy} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import cx from "classnames"
  import {ago, MINUTE} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {stamp} from "@welshman/util"
  import {Message} from "@welshman/domain"
  import {MembershipStatus} from "@welshman/app"
  import Close from "@assets/icons/close.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ComposeArea, {type ComposeValues} from "@app/components/ComposeArea.svelte"
  import RoomCallPane from "@app/components/RoomCallPane.svelte"
  import RoomMembershipButton from "@app/components/RoomMembershipButton.svelte"
  import RoomPinnedMessages from "@app/components/RoomPinnedMessages.svelte"
  import RoomTranscript from "@app/components/RoomTranscript.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import CallControlBar from "@app/components/CallControlBar.svelte"
  import {deletes, relays, rooms, thunks, user, writer} from "@app/core"
  import {
    CallState,
    callState,
    deriveRoomCallState,
    VideoCallLayout,
    videoCallLayout,
  } from "@app/call"
  import {
    RoomType,
    deriveUserRoomMembershipStatus,
    getRoomType,
    prependParent,
    addressWriterToSpace,
  } from "@app/rooms"
  import {loadSendDelay} from "@app/settings"
  import {deferredRoomPath, setChecked} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const room = h ? $rooms.forRoom(url, h) : readable(undefined)
  const isVoiceRoom = $derived($room && getRoomType($room) === RoomType.Voice)

  const roomCallState = deriveRoomCallState(url, h)

  const voiceConnectedHere = $derived(isVoiceRoom && $roomCallState === CallState.Connected)

  // voiceConnectedHere can't stay true for a voice room the call isn't targeting.
  const callChatOpen = $derived(voiceConnectedHere && $videoCallLayout === VideoCallLayout.Split)
  const callChatHidden = $derived(voiceConnectedHere && !callChatOpen)

  const roomPath = h ? makeRoomPath(url, h) : undefined

  const closeChat = () => videoCallLayout.set(VideoCallLayout.Video)

  $effect(() => {
    deferredRoomPath.set(callChatHidden ? roomPath : undefined)
    if (roomPath && callChatOpen) {
      setChecked(roomPath)
    }
  })

  onDestroy(() => deferredRoomPath.set(undefined))

  let wasConnectedHere = $state(false)

  $effect(() => {
    if (!voiceConnectedHere) {
      if ($callState !== CallState.Connected) {
        videoCallLayout.set(VideoCallLayout.Chat)
      }
      wasConnectedHere = false
      return
    }

    // Chat is one tap away on the control bar, so land on the call view whether or not a camera is on.
    if (!wasConnectedHere) {
      videoCallLayout.set(VideoCallLayout.Video)
      wasConnectedHere = true
    }
  })

  const shouldProtect = $relays.hasNip(url, 70)
  const membershipStatus = h
    ? deriveUserRoomMembershipStatus(url, h)
    : readable(MembershipStatus.Granted)
  const locked = $derived(
    $room?.meta?.isPrivate() && $membershipStatus !== MembershipStatus.Granted,
  )

  // Restart the feed now that we're a member
  const onJoin = () => transcript?.restart()

  const replyTo = (event: TrustedEvent) => composeArea?.reply(event)

  const onSubmit = async ({content, tags, parent, share, edit}: ComposeValues) => {
    if (edit) {
      const protect = await shouldProtect

      // Delete the previous message, to be republished below with the same timestamp
      const command = await $deletes.deleteEvent($state.snapshot(edit), w =>
        w.setProtected(protect),
      )

      command.publishToRelays([url])
    }

    // A share is a quote rather than a reply, so setParent prepends the reply's own reference ahead of it.
    if (share) {
      ;({content, tags} = await prependParent(share, {content, tags}, url))
    }

    const eventWriter = await addressWriterToSpace(
      writer(Message)
        .setContent(content)
        .addTags(...tags),
      url,
      h,
    )

    if (parent) {
      eventWriter.setParent(parent)
    }

    const delay = await loadSendDelay()

    const thunk = $thunks.publish({
      relays: [url],
      event: stamp(await eventWriter.renderTemplate(), edit?.created_at),
      delay,
    })

    if (delay) {
      pushToast({
        timeout: 30_000,
        children: {
          component: ThunkToast,
          props: {thunk},
        },
      })
    }
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $user.pubkey && event.created_at >= ago(5, MINUTE)

  const onEditEvent = (event: TrustedEvent) => composeArea?.edit(event)

  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let transcript: RoomTranscript | undefined = $state()
  let composeArea: ComposeArea | undefined = $state()
</script>

<div
  class={cx(
    "room flex min-h-0 min-w-0 flex-1 flex-col",
    voiceConnectedHere && "bg-surface xl:flex-row xl:overflow-hidden",
  )}>
  {#if h && voiceConnectedHere}
    <RoomCallPane {url} {h} />
  {/if}

  <!-- Closed at xl, the negative margin takes the panel out of the flex line without
       changing its width, parking it past the room's clipped right edge — so the
       transition slides it in at full size rather than squeezing its contents. It
       only drops out of the layout below xl, where it has nothing to share the pane
       with. inert (not just pointer-events) so a parked panel leaves the tab order. -->
  <div
    inert={callChatHidden}
    class={cx(
      "relative flex min-h-0 min-w-0 flex-1 flex-col",
      voiceConnectedHere &&
        "xl:w-96 xl:flex-none xl:border-l xl:border-line xl:transition-[margin-right] xl:duration-200",
      callChatHidden && "max-xl:hidden xl:-mr-96",
    )}>
    {#if callChatOpen}
      <Button
        aria-label="Close room chat"
        class="button button-neutral button-xs button-circle absolute right-2 top-2 z-popover"
        onclick={closeChat}>
        <Icon icon={Close} size={4} />
      </Button>
    {/if}

    {#if h}
      <RoomPinnedMessages {url} {h} />
    {/if}

    <RoomTranscript
      {url}
      {h}
      {locked}
      {replyTo}
      canEdit={canEditEvent}
      onEdit={onEditEvent}
      bind:events
      bind:this={transcript} />

    <div class="room__compose flex items-center gap-1 px-2">
      <div class="room__compose-inner min-w-0 flex-1">
        {#if locked}
          <!-- pass -->
        {:else if h && $room?.meta?.isRestricted() && $membershipStatus !== MembershipStatus.Granted}
          <div class="card m-4 flex flex-row items-center justify-between px-4 py-3">
            <p class="opacity-75">Only members are allowed to post to this room.</p>
            <RoomMembershipButton {url} {h} label="Ask to Join" {onJoin} />
          </div>
        {:else}
          <ComposeArea
            {url}
            {h}
            {onSubmit}
            draftKey="room:{url}:{h ?? ''}"
            messages={$events.toReversed()}
            canEdit={canEditEvent}
            bind:this={composeArea} />
        {/if}
      </div>
      {#if h && isVoiceRoom && !voiceConnectedHere}
        <div class="hide-on-keyboard flex shrink-0 items-center justify-center py-2">
          <CallControlBar {url} {h} />
        </div>
      {/if}
    </div>
  </div>
</div>
