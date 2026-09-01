<script lang="ts">
  import type {Snippet} from "svelte"
  import {randomId} from "@welshman/lib"
  import type {RoomMeta} from "@welshman/app"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Volume from "@assets/icons/volume.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import IconInput from "@lib/components/IconInput.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {rooms} from "@app/core"
  import {joinRoom} from "@app/access"
  import {pushToast} from "@app/toast"
  import {resolveImageInput} from "@app/uploads"
  import {deriveHasLivekit} from "@app/relays"
  import {RoomType} from "@app/rooms"

  type Props = {
    url: string
    header: Snippet
    footer: Snippet<[{loading: boolean}]>
    onsubmit: (room: RoomMeta) => void
    initialValues?: RoomMeta
  }

  const {url, header, footer, onsubmit, initialValues = {h: randomId()}}: Props = $props()

  const compressOptions = {maxWidth: 128, maxHeight: 128}

  const values = $state(initialValues)
  const relayHasLivekit = deriveHasLivekit(url)

  const submit = async () => {
    const room = $state.snapshot(values)

    if (roomType === RoomType.Voice && !$relayHasLivekit) {
      return pushToast({
        theme: "error",
        message: "This relay does not support voice rooms.",
      })
    }

    room.livekit = roomType === RoomType.Voice

    room.picture = await resolveImageInput(imageFile, imagePreview, compressOptions)

    const createCommand = await $rooms.createRoom(url, room)
    const createMessage = await createCommand.publish().waitForError()

    if (createMessage && !createMessage.includes("already")) {
      return pushToast({theme: "error", message: createMessage})
    }

    const editCommand = await $rooms.editRoom(url, room)
    const editMessage = await editCommand.publish().waitForError()

    if (editMessage) {
      return pushToast({theme: "error", message: editMessage})
    }

    const joinMessage = await joinRoom(url, room.h)

    if (joinMessage) {
      return pushToast({theme: "error", message: joinMessage})
    }

    onsubmit(room)
  }

  const trySubmit = async () => {
    loading = true

    try {
      await submit()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let imageFile = $state<File | undefined>()
  let imagePreview = $state(initialValues.picture)
  let roomType = $state(initialValues.livekit ? RoomType.Voice : RoomType.Text)
</script>

<Modal tag="form" onsubmit={preventDefault(trySubmit)}>
  <ModalBody>
    {@render header()}
    <FieldInline>
      {#snippet label()}
        <p>Icon</p>
      {/snippet}
      {#snippet input()}
        <IconInput bind:file={imageFile} bind:preview={imagePreview} previewClass="rounded-xl" />
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Name</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-group flex w-full items-center gap-2">
          {#if imagePreview}
            <ImageIcon src={imagePreview} alt="" class="rounded-xl" />
          {:else}
            <Icon icon={roomType === RoomType.Voice ? Volume : Hashtag} />
          {/if}
          <input bind:value={values.name} class="grow" type="text" />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Description</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-group flex w-full items-center gap-2">
          <input bind:value={values.about} class="grow" type="text" />
        </label>
      {/snippet}
    </FieldInline>
    {#if $relayHasLivekit}
      <FieldInline>
        {#snippet label()}
          <p>Room type</p>
        {/snippet}
        {#snippet input()}
          <select class="select input w-full" bind:value={roomType} aria-label="Room type">
            <option value={RoomType.Text}>Text</option>
            <option value={RoomType.Voice}>Voice</option>
          </select>
        {/snippet}
      </FieldInline>
    {/if}
    <strong class="md:hidden">Permissions</strong>
    <div class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" bind:checked={values.isRestricted} />
      <span class="text-sm opacity-75">Only allow members to send messages</span>
    </div>
    <div class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" bind:checked={values.isPrivate} />
      <span class="text-sm opacity-75">Only allow members to read messages</span>
    </div>
    <div class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" bind:checked={values.isHidden} />
      <span class="text-sm opacity-75">Hide this group from non-members</span>
    </div>
    <div class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" bind:checked={values.isClosed} />
      <span class="text-sm opacity-75">Membership requires approval</span>
    </div>
  </ModalBody>
  {@render footer({loading})}
</Modal>
