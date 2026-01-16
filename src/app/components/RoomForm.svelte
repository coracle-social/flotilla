<script lang="ts">
  import type {Snippet} from "svelte"
  import type {RoomMeta} from "@welshman/util"
  import {makeRoomMeta} from "@welshman/util"
  import {waitForThunkError, createRoom, editRoom, joinRoom} from "@welshman/app"
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import IconPickerButton from "@lib/components/IconPickerButton.svelte"
  import {pushToast} from "@app/util/toast"
  import {uploadFile} from "@app/core/commands"

  type Props = {
    url: string
    header: Snippet
    footer: Snippet<[{loading: boolean}]>
    onsubmit: (room: RoomMeta) => void
    initialValues?: RoomMeta
  }

  const {url, header, footer, onsubmit, initialValues = makeRoomMeta()}: Props = $props()

  const values = $state(initialValues)

  const submit = async () => {
    const room = $state.snapshot(values)

    if (imageFile) {
      const {error, result} = await uploadFile(imageFile, {maxWidth: 128, maxHeight: 128})

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      room.picture = result.url
      room.pictureMeta = result.tags
    }

    const createMessage = await waitForThunkError(createRoom(url, room))

    if (createMessage && !createMessage.includes("already")) {
      return pushToast({theme: "error", message: createMessage})
    }

    const editMessage = await waitForThunkError(editRoom(url, room))

    if (editMessage) {
      return pushToast({theme: "error", message: editMessage})
    }

    const joinMessage = await waitForThunkError(joinRoom(url, room))

    if (joinMessage && !joinMessage.includes("already")) {
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

  const handleImageUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]

    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()

      reader.onload = e => {
        imageFile = file
        imagePreview = e.target?.result as string
      }

      reader.readAsDataURL(file)
    }
  }

  const handleIconSelect = (iconUrl: string) => {
    imagePreview = iconUrl

    const parts = iconUrl.split(",")
    const imageData = atob(parts[1])
    const result = new Uint8Array(imageData.length)

    for (let n = 0; n < imageData.length; n++) {
      result[n] = imageData.charCodeAt(n)
    }

    imageFile = new File([result], `icon.svg`, {type: "image/svg+xml"})
  }
</script>

<form class="column gap-4" onsubmit={preventDefault(trySubmit)}>
  {@render header()}
  <FieldInline>
    {#snippet label()}
      <p>Icon</p>
    {/snippet}
    {#snippet input()}
      <div class="flex flex-grow items-center justify-between gap-4">
        {#if imagePreview}
          <div class="flex items-center gap-2">
            <span class="text-sm opacity-75">Selected:</span>
            <ImageIcon src={imagePreview} alt="" class="rounded-lg" />
          </div>
        {:else}
          <span class="text-sm opacity-75">No icon selected</span>
        {/if}
        <div class="flex gap-2">
          <IconPickerButton onSelect={handleIconSelect} class="btn btn-primary btn-xs">
            <Icon icon={StickerSmileSquare} size={4} />
            <span class="hidden sm:inline">Select</span>
          </IconPickerButton>
          <label class="btn btn-neutral btn-xs cursor-pointer">
            <Icon icon={UploadMinimalistic} size={4} />
            <span class="hidden sm:inline">Upload</span>
            <input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
          </label>
        </div>
      </div>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Name</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        {#if imagePreview}
          <ImageIcon src={imagePreview} alt="" class="rounded-lg" />
        {:else}
          <Icon icon={Hashtag} />
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
      <label class="input input-bordered flex w-full items-center gap-2">
        <input bind:value={values.about} class="grow" type="text" />
      </label>
    {/snippet}
  </FieldInline>
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
    <span class="text-sm opacity-75">Ignore requests to join</span>
  </div>
  {@render footer({loading})}
</form>
