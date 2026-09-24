<script lang="ts">
  import {navigate} from "@app/modal"
  import {page} from "$app/stores"
  import cx from "classnames"
  import {displayRelayUrl} from "@welshman/util"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import MicrophoneOff from "@assets/icons/microphone-off.svg?dataurl"
  import EndCall from "@assets/icons/end-call-rounded.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Banner from "@app/components/Banner.svelte"
  import {decodeRelay} from "@app/relays"
  import {displayRoom} from "@app/rooms"
  import {makeRoomPath} from "@app/routes"
  import {
    CallState,
    callState,
    callTargetRoom,
    callMicMuted,
    deriveIsCallActiveElsewhere,
    endCall,
  } from "@app/call"

  const {relay, h} = $derived($page.params)
  const routeUrl = $derived(relay ? decodeRelay(relay) : undefined)

  // CallControlBar already shows full controls on the call's own room page.
  const isCallActiveElsewhere = $derived(
    deriveIsCallActiveElsewhere(routeUrl, typeof h === "string" ? h : undefined),
  )
  const visible = $derived($isCallActiveElsewhere)

  const roomName = $derived(
    $callTargetRoom ? displayRoom($callTargetRoom.url, $callTargetRoom.h) : "",
  )
  const spaceName = $derived($callTargetRoom ? displayRelayUrl($callTargetRoom.url) : "")

  const goToRoom = () => {
    if (!$callTargetRoom) {
      return
    }
    void navigate(makeRoomPath($callTargetRoom.url, $callTargetRoom.h))
  }

  const toggleMute = async () => {
    const engine = await import("@app/callEngine")

    await engine.toggleMute()
  }
</script>

{#if visible}
  <Banner>
    <Button
      class="flex min-w-0 flex-1 items-center gap-2 text-left"
      onclick={goToRoom}
      aria-label="Return to call in {roomName}">
      <span
        class={cx("h-2 w-2 shrink-0 rounded-full", {
          "animate-pulse bg-warning": $callState === CallState.Joining,
          "bg-success": $callState === CallState.Connected,
        })}
        aria-hidden="true"></span>
      <span class="min-w-0 truncate text-sm">
        <span class="font-semibold">
          {$callState === CallState.Joining ? "Joining call…" : "Voice connected"}
        </span>
        <span class="text-content-muted">· {roomName} / {spaceName}</span>
      </span>
    </Button>
    <div class="flex shrink-0 items-center gap-2">
      {#if $callState === CallState.Connected}
        <Button
          aria-label={$callMicMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!$callMicMuted}
          class={cx(
            "button button-circle button-sm",
            $callMicMuted ? "button-neutral" : "button-primary",
          )}
          onclick={toggleMute}>
          <Icon icon={$callMicMuted ? MicrophoneOff : Microphone} size={4} />
        </Button>
      {/if}
      <Button
        aria-label={$callState === CallState.Joining
          ? "Cancel joining voice room"
          : "Leave voice room"}
        class="button button-circle button-sm button-error"
        onclick={endCall}>
        <Icon icon={EndCall} size={4} />
      </Button>
    </div>
  </Banner>
{/if}
