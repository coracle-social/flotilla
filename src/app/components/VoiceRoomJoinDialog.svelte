<script lang="ts">
  import {spec} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Volume from "@assets/icons/volume.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import {AbortError, TimeoutError} from "$lib/util"
  import MicLevelMeter from "@app/components/MicLevelMeter.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {displayRoom} from "@app/rooms"
  import {deriveCallParticipants, loadCallParticipants} from "@app/call"
  import {joinVoiceRoom} from "@app/callEngine"
  import {popModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const spaceLabel = $derived(displayRelayUrl(url))
  const participants = deriveCallParticipants(url, h)
  const participantPubkeys = $derived($participants.flatMap(p => (p.pubkey ? [p.pubkey] : [])))

  let audioInputs = $state<MediaDeviceInfo[]>([])
  let selectedDeviceId = $state("")
  let startWithoutMic = $state(false)
  let micError = $state(false)

  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      audioInputs = devices.filter(spec({kind: "audioinput"}))
    } catch {
      audioInputs = []
    }
  }

  $effect(() => {
    void loadCallParticipants(url, h)
    void loadDevices()
  })

  // The stream stays a plain local, since reading reactive state this effect writes would re-run it.
  let previewStream: MediaStream | undefined
  let previewTrack = $state<MediaStreamTrack | undefined>(undefined)

  const stopMicPreview = () => {
    previewStream?.getTracks().forEach(t => t.stop())
    previewStream = undefined
    previewTrack = undefined
  }

  $effect(() => {
    // Re-runs when selectedDeviceId or startWithoutMic changes.
    void selectedDeviceId
    const withoutMic = startWithoutMic

    stopMicPreview()
    micError = false

    if (withoutMic || !navigator.mediaDevices?.getUserMedia) {
      return
    }

    let cancelled = false
    const deviceId = selectedDeviceId

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? {deviceId: {exact: deviceId}} : true,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        previewStream = stream
        previewTrack = stream.getAudioTracks()[0]
      } catch {
        if (!cancelled) {
          micError = true
        }
      }
    })()

    return () => {
      cancelled = true
      stopMicPreview()
    }
  })

  const goBack = () => {
    stopMicPreview()
    history.back()
  }

  const handleJoinError = (e: unknown) => {
    if (e instanceof AbortError) {
      return
    }
    console.error("Failed to join voice room", e)
    let message = "Failed to join voice room"
    if (e instanceof TimeoutError) {
      message = "Connection timed out. Please check your network and try again."
    } else if (e instanceof Error) {
      message = e.message
    }
    pushToast({theme: "error", message})
  }

  const joinVoice = async () => {
    stopMicPreview()
    popModal()
    await joinVoiceRoom(
      url,
      h,
      startWithoutMic,
      startWithoutMic ? undefined : selectedDeviceId || undefined,
    ).catch(handleJoinError)
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Join voice room?</ModalTitle>
      <ModalSubtitle>
        <span class="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <Icon icon={Volume} size={4} class="shrink-0" />
          <span class="truncate min-w-0">{displayRoom(url, h)}</span>
          <span>·</span>
          <span>{spaceLabel}</span>
        </span>
      </ModalSubtitle>
    </ModalHeader>
    {#if participantPubkeys.length > 0}
      <div class="flex justify-center py-2">
        <ProfileCircles pubkeys={participantPubkeys} size={5} limit={3} />
      </div>
    {/if}
    <p class="text-sm opacity-80">Select a microphone to join the call:</p>
    <div class="flex flex-col gap-4 pt-2">
      <div class="flex items-center gap-2">
        <input
          id="voice-start-without-mic"
          type="checkbox"
          class="checkbox"
          bind:checked={startWithoutMic} />
        <label for="voice-start-without-mic" class="text-sm cursor-pointer">
          Join without microphone (you can unmute later)
        </label>
      </div>
      <FieldInline>
        {#snippet label()}
          <p>Microphone</p>
        {/snippet}
        {#snippet input()}
          <select
            class="select input w-full"
            bind:value={selectedDeviceId}
            disabled={startWithoutMic}
            aria-label="Microphone">
            <option value="">Default microphone</option>
            {#each audioInputs as d (d.deviceId)}
              <option value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}…`}
              </option>
            {/each}
          </select>
        {/snippet}
      </FieldInline>
      {#if !startWithoutMic}
        <MicLevelMeter
          track={previewTrack}
          error={micError
            ? "Could not access this microphone. Check your browser permissions, or join without one."
            : undefined} />
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={goBack}>
      <Icon icon={AltArrowLeft} />
      Don't join
    </Button>
    <Button class="button button-primary" onclick={joinVoice}>Join voice</Button>
  </ModalFooter>
</Modal>
