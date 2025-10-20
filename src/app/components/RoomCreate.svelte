<script lang="ts">
  import {goto} from "$app/navigation"
  import {uniqBy, nth} from "@welshman/lib"
  import {displayRelayUrl, makeRoomMeta} from "@welshman/util"
  import {deriveRelay, waitForThunkError, createRoom, editRoom, joinRoom} from "@welshman/app"
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import {preventDefault, compressFile} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import IconPickerButton from "@lib/components/IconPickerButton.svelte"
  import {hasNip29, loadChannel} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {pushToast} from "@app/util/toast"
  import {uploadFile} from "@app/core/commands"

  const {url} = $props()

  const room = makeRoomMeta()
  const relay = deriveRelay(url)

  const back = () => history.back()

  const tryCreate = async () => {
    room.tags = uniqBy(nth(0), [...room.tags, ["name", name]])

    if (imageFile) {
      const {error, result} = await uploadFile(imageFile)

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      room.tags.push(["picture", result.url, ...result.tags])
    } else if (selectedIcon) {
      room.tags.push(["picture", selectedIcon])
    }

    const createMessage = await waitForThunkError(createRoom(url, room))

    if (createMessage && !createMessage.match(/^duplicate:|already a member/)) {
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

    await loadChannel(url, room.id)

    goto(makeSpacePath(url, room.id))
  }

  const create = async () => {
    loading = true

    try {
      await tryCreate()
    } finally {
      loading = false
    }
  }

  let name = $state("")
  let loading = $state(false)
  let imageFile = $state<File | undefined>()
  let imagePreview = $state<string | undefined>()
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

<form class="column gap-4" onsubmit={preventDefault(create)}>
  <ModalHeader>
    {#snippet title()}
      <div>Create a Room</div>
    {/snippet}
    {#snippet info()}
      <div>
        On <span class="text-primary">{displayRelayUrl(url)}</span>
      </div>
    {/snippet}
  </ModalHeader>
  {#if hasNip29($relay)}
    <FieldInline>
      {#snippet label()}
        <p>Room Name</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Hashtag} />
          <input bind:value={name} class="grow" type="text" />
        </label>
      {/snippet}
    </FieldInline>
    <div class="flex items-center justify-between">
      <p class="font-bold">Room Icon</p>
      <div class="flex items-center gap-4">
        {#if imagePreview}
          <div class="flex items-center gap-2">
            <span class="text-sm opacity-75">Selected:</span>
            <img
              src={imagePreview}
              alt="Room icon preview"
              class="h-8 w-8 rounded-lg object-cover" />
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
  {:else}
    <p class="bg-alt card2 row-2">
      <Icon icon={Danger} />
      This relay does not support creating rooms.
    </p>
  {/if}
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!name || loading || !hasNip29($relay)}>
      <Spinner {loading}>Create Room</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
