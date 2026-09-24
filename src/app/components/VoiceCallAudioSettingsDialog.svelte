<script lang="ts">
  import {spec} from "@welshman/lib"
  import {RoomEvent, Track, supportsAudioOutputSelection} from "livekit-client"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import MicLevelMeter from "@app/components/MicLevelMeter.svelte"
  import {currentCallSession, DeviceKind, type CallSession} from "@app/call"
  import {switchCallActiveDevice} from "@app/callEngine"
  import {popModal} from "@app/modal"

  const selectValueForActiveDevice = (session: CallSession, kind: DeviceKind): string => {
    const livekitDeviceId = session.livekit.getActiveDevice(kind)
    if (livekitDeviceId === undefined || livekitDeviceId === "" || livekitDeviceId === "default") {
      return ""
    }
    return livekitDeviceId
  }

  let audioInputs = $state<MediaDeviceInfo[]>([])
  let audioOutputs = $state<MediaDeviceInfo[]>([])
  let videoInputs = $state<MediaDeviceInfo[]>([])
  let selectedInput = $state("")
  let selectedOutput = $state("")
  let selectedVideo = $state("")
  let micTrack = $state<MediaStreamTrack | undefined>(undefined)

  const readMicTrack = (session: CallSession): MediaStreamTrack | undefined =>
    session.livekit.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
      ?.mediaStreamTrack

  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      audioInputs = devices.filter(spec({kind: "audioinput"}))
      audioOutputs = devices.filter(spec({kind: "audiooutput"}))
      videoInputs = devices.filter(spec({kind: "videoinput"}))
    } catch {
      audioInputs = []
      audioOutputs = []
      videoInputs = []
    }
  }

  $effect(() => {
    loadDevices()
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices)
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices)
  })

  $effect(() => {
    const session = $currentCallSession
    if (!session) {
      popModal()
      return
    }
    selectedInput = selectValueForActiveDevice(session, DeviceKind.AudioInput)
    selectedOutput = selectValueForActiveDevice(session, DeviceKind.AudioOutput)
    selectedVideo = selectValueForActiveDevice(session, DeviceKind.VideoInput)

    // Mute and unmute publishes or unpublishes the microphone track.
    const {livekit} = session
    const refreshMicTrack = () => {
      micTrack = readMicTrack(session)
    }
    refreshMicTrack()
    livekit.on(RoomEvent.LocalTrackPublished, refreshMicTrack)
    livekit.on(RoomEvent.LocalTrackUnpublished, refreshMicTrack)
    return () => {
      livekit.off(RoomEvent.LocalTrackPublished, refreshMicTrack)
      livekit.off(RoomEvent.LocalTrackUnpublished, refreshMicTrack)
    }
  })

  const onInputChange = async () => {
    await switchCallActiveDevice(DeviceKind.AudioInput, selectedInput)
    // Switching device restarts the LocalAudioTrack in place rather than emitting a publish event.
    const session = $currentCallSession
    if (session) {
      micTrack = readMicTrack(session)
    }
  }

  const onOutputChange = () => {
    void switchCallActiveDevice(DeviceKind.AudioOutput, selectedOutput)
  }

  const onVideoChange = () => {
    void switchCallActiveDevice(DeviceKind.VideoInput, selectedVideo)
  }

  const onDone = () => {
    popModal()
  }

  // Output not support in Safari
  const canPickOutput = supportsAudioOutputSelection()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Call settings</ModalTitle>
      <ModalSubtitle>Microphone, speaker, and camera for this call.</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-4 pt-2">
      <FieldInline>
        {#snippet label()}
          <p>Microphone</p>
        {/snippet}
        {#snippet input()}
          <select
            class="select input w-full"
            bind:value={selectedInput}
            onchange={onInputChange}
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
      <MicLevelMeter track={micTrack} offMessage="Microphone is off — unmute to test it" />
      {#if canPickOutput}
        <FieldInline>
          {#snippet label()}
            <p>Speaker</p>
          {/snippet}
          {#snippet input()}
            <select
              class="select input w-full"
              bind:value={selectedOutput}
              onchange={onOutputChange}
              aria-label="Speaker">
              <option value="">Default speaker</option>
              {#each audioOutputs as d (d.deviceId)}
                <option value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}…`}
                </option>
              {/each}
            </select>
          {/snippet}
        </FieldInline>
      {/if}
      <FieldInline>
        {#snippet label()}
          <p>Camera</p>
        {/snippet}
        {#snippet input()}
          <select
            class="select input w-full"
            bind:value={selectedVideo}
            onchange={onVideoChange}
            aria-label="Camera">
            <option value="">Default camera</option>
            {#each videoInputs as d (d.deviceId)}
              <option value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}…`}
              </option>
            {/each}
          </select>
        {/snippet}
      </FieldInline>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary button-block" onclick={onDone}>Done</Button>
  </ModalFooter>
</Modal>
