<script lang="ts">
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import IconPickerButton from "@lib/components/IconPickerButton.svelte"
  import ImageInputButton from "@lib/components/ImageInputButton.svelte"

  type Props = {
    // The parent uploads this on submit — never `preview`, which may be a data: URL.
    file?: File | undefined
    // An existing hosted URL, the data: URL of a freshly picked image, or a URL the user pasted.
    preview?: string | undefined
    previewClass?: string
  }

  let {file = $bindable(), preview = $bindable(), previewClass = ""}: Props = $props()

  const initialUrlValue = $derived(preview?.startsWith("data:") ? undefined : preview)

  // A built-in icon is a base64 SVG data url, so decode it into a File and upload it like any image.
  const handleIconSelect = (iconUrl: string) => {
    preview = iconUrl

    const parts = iconUrl.split(",")
    const imageData = atob(parts[1])
    const bytes = new Uint8Array(imageData.length)

    for (let n = 0; n < imageData.length; n++) {
      bytes[n] = imageData.charCodeAt(n)
    }

    file = new File([bytes], "icon.svg", {type: "image/svg+xml"})
  }

  const handleImageSelect = (image: File | string) => {
    if (typeof image === "string") {
      file = undefined
      preview = image
      return
    }

    const reader = new FileReader()

    reader.onload = e => {
      file = image
      preview = e.target?.result as string
    }

    reader.readAsDataURL(image)
  }
</script>

<div class="flex grow items-center justify-between gap-4">
  {#if preview}
    <div class="flex items-center gap-2">
      <span class="text-sm opacity-75">Selected:</span>
      <ImageIcon src={preview} alt="" class={previewClass} />
    </div>
  {:else}
    <span class="text-sm opacity-75">No icon selected</span>
  {/if}
  <div class="flex gap-2">
    <IconPickerButton onSelect={handleIconSelect} class="button button-primary button-sm">
      <Icon icon={StickerSmileSquare} size={4} />
    </IconPickerButton>
    <ImageInputButton
      onSelect={handleImageSelect}
      initialValue={initialUrlValue}
      aria-label="Add an image"
      class="button button-neutral button-sm">
      <Icon icon={UploadMinimalistic} size={4} />
    </ImageInputButton>
  </div>
</div>
