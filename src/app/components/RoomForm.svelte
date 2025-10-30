<script lang="ts">
  import type {Snippet} from "svelte"
  import type {RoomMeta} from "@welshman/util"
  import {makeRoomMeta} from "@welshman/util"
  import {waitForThunkError, createRoom, editRoom, joinRoom} from "@welshman/app"
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import {preventDefault, compressFile} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
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
      const {error, result} = await uploadFile(imageFile)

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      room.picture = result.url
      room.pictureMeta = result.tags
    } else if (selectedIcon) {
      room.picture = selectedIcon
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
  let selectedIcon = $state<string | undefined>()

  const handleImageUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]

    if (file && file.type.startsWith("image/")) {
      selectedIcon = undefined
      imageFile = await compressFile(file, {maxWidth: 64, maxHeight: 64})

      const reader = new FileReader()

      reader.onload = e => {
        imagePreview = e.target?.result as string
      }

      reader.readAsDataURL(imageFile)
    }
  }

  const handleIconSelect = (iconUrl: string) => {
    imageFile = undefined
    imagePreview = undefined
    selectedIcon = iconUrl
  }
</script>

<form class="column gap-4" onsubmit={preventDefault(trySubmit)}>
  {@render header()}
  <FieldInline>
    {#snippet label()}
      <p>Icon</p>
    {/snippet}
    {#snippet input()}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          {#if imagePreview}
            <div class="flex items-center gap-2">
              <span class="text-sm opacity-75">Selected:</span>
              <img src={imagePreview} alt="Room icon preview" class="h-5 w-5 rounded-lg object-cover" />
            </div>
          {:else if selectedIcon}
            <div class="flex items-center gap-2">
              <span class="text-sm opacity-75">Selected:</span>
              <Icon icon={selectedIcon} class="h-8 w-8" />
            </div>
          {:else}
            <span class="text-sm opacity-75">No icon selected</span>
          {/if}
          <div class="flex gap-2">
            <IconPickerButton onSelect={handleIconSelect} class="btn btn-primary btn-sm">
              <Icon icon={StickerSmileSquare} size={4} />
              Select
            </IconPickerButton>
            <label class="btn btn-neutral btn-sm cursor-pointer">
              <Icon icon={UploadMinimalistic} size={4} />
              Upload
              <input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
            </label>
          </div>
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
          <img src={imagePreview} alt="Room icon preview" class="h-5 w-5 rounded-lg object-cover" />
        {:else if selectedIcon}
          <Icon icon={selectedIcon} class="h-8 w-8" />
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
        <input bind:value={values.description} class="grow" type="text" />
      </label>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Access Control</p>
    {/snippet}
    {#snippet input()}
      <div class="flex items-center justify-end gap-4">
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={values.isClosed} />
          Closed
        </span>
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={values.isPrivate} />
          Private
        </span>
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={values.isHidden} />
          Hidden
        </span>
      </div>
    {/snippet}
    {#snippet info()}
      <p>Only members can send messages to closed groups and read messages from private groups.</p>
    {/snippet}
  </FieldInline>
  {@render footer({loading})}
</form>
