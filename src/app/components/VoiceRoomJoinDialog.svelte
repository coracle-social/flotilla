<script lang="ts">
  import {spec} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Volume from "@assets/icons/volume.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import {listMediaDevices} from "@lib/audio"
  import MicLevelMeter from "@app/components/MicLevelMeter.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {displayRoom} from "@app/features/rooms"
  import {deriveCallParticipants, loadCallParticipants} from "@app/features/call"
  import {AbortError, TimeoutError, joinVoiceRoom} from "@app/features/callEngine"
  import {popModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

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
  let micError = $state(false)

  const withoutMic = $derived(selectedDeviceId === "none")

  const loadDevices = async () => {
    audioInputs = (await listMediaDevices()).filter(spec({kind: "audioinput"}))
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
    const deviceId = selectedDeviceId

    stopMicPreview()
    micError = false

    if (deviceId === "none" || !navigator.mediaDevices?.getUserMedia) {
      return
    }

    let cancelled = false

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
      withoutMic,
      withoutMic ? undefined : selectedDeviceId || undefined,
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
    <Field>
      {#snippet label()}
        <p>Microphone</p>
      {/snippet}
      {#snippet input()}
        <select class="select input w-full" bind:value={selectedDeviceId} aria-label="Microphone">
          <option value="">Default microphone</option>
          {#each audioInputs as d (d.deviceId)}
            <option value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}…`}
            </option>
          {/each}
          <option value="none">No microphone</option>
        </select>
      {/snippet}
    </Field>
    {#if withoutMic}
      <p class="text-sm opacity-50">You can turn your microphone on after joining.</p>
    {:else}
      <MicLevelMeter
        track={previewTrack}
        error={micError ? "Could not access this microphone." : undefined} />
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={goBack}>
      <Icon icon={AltArrowLeft} />
      Cancel
    </Button>
    <Button class="button button-primary" onclick={joinVoice}>Join call</Button>
  </ModalFooter>
</Modal>
