<script lang="ts">
  import type {RelayProfile} from "@welshman/util"
  import {displayRelayUrl, ManagementMethod} from "@welshman/util"
  import {manageRelay, forceLoadRelay} from "@welshman/app"
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import SettingsMinimalistic from "@assets/icons/settings-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import IconPickerButton from "@lib/components/IconPickerButton.svelte"
  import {pushToast} from "@app/util/toast"
  import {clearModals} from "@app/util/modal"
  import {uploadFile} from "@app/core/commands"

  type Props = {
    url: string
    initialValues: Partial<RelayProfile>
  }

  const {url, initialValues = {}}: Props = $props()

  const values = $state(initialValues)

  const back = () => history.back()

  const submit = async () => {
    if (values.name != initialValues.name) {
      const res = await manageRelay(url, {
        method: ManagementMethod.ChangeRelayName,
        params: [values.name || ""],
      })

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    if (values.description != initialValues.description) {
      const res = await manageRelay(url, {
        method: ManagementMethod.ChangeRelayDescription,
        params: [values.description || ""],
      })

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    if (imageFile) {
      const {error, result} = await uploadFile(imageFile, {maxWidth: 256, maxHeight: 256})

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      const res = await manageRelay(url, {
        method: ManagementMethod.ChangeRelayIcon,
        params: [result.url],
      })

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    pushToast({message: "Your changes have been saved!"})
    forceLoadRelay(url)
    clearModals()
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
  let imagePreview = $state(initialValues.icon)

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

<Modal tag="form" onsubmit={preventDefault(trySubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Edit a Space</ModalTitle>
      <ModalSubtitle><span class="text-primary">{displayRelayUrl(url)}</span></ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>Icon</p>
      {/snippet}
      {#snippet input()}
        <div class="flex items-center gap-4 justify-between flex-grow">
          {#if imagePreview}
            <div class="flex items-center gap-2">
              <span class="text-sm opacity-75">Selected:</span>
              <ImageIcon src={imagePreview} alt="" />
            </div>
          {:else}
            <span class="text-sm opacity-75">No icon selected</span>
          {/if}
          <div class="flex gap-2">
            <IconPickerButton onSelect={handleIconSelect} class="btn btn-primary btn-sm">
              <Icon icon={StickerSmileSquare} size={4} />
            </IconPickerButton>
            <label class="btn btn-neutral btn-sm cursor-pointer">
              <Icon icon={UploadMinimalistic} size={4} />
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
            <ImageIcon src={imagePreview} alt="" />
          {:else}
            <Icon icon={SettingsMinimalistic} />
          {/if}
          <input bind:value={values.name} class="grow" type="text" />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p class="flex flex-col items-start h-full">Description</p>
      {/snippet}
      {#snippet input()}
        <textarea
          bind:value={values.description}
          class="min-h-24 textarea textarea-bordered flex w-full"></textarea>
      {/snippet}
    </FieldInline>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Save Changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
