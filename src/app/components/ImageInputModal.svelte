<script lang="ts">
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {popModal} from "@app/modal"

  type Props = {
    onSelect: (image: File | string) => void
    initialValue?: string
  }

  const {onSelect, initialValue = ""}: Props = $props()

  const isValidUrl = (value: string) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol)
    } catch (e) {
      return false
    }
  }

  const select = (image: File | string) => {
    onSelect(image)
    popModal()
  }

  const onFileChange = (event: Event) => {
    const selected = (event.target as HTMLInputElement).files?.[0]

    if (selected?.type.startsWith("image/")) {
      select(selected)
    }
  }

  let value = $state(initialValue)

  let failedUrl = $state("")

  const url = $derived(value.trim())
  const isValid = $derived(isValidUrl(url))
  const failed = $derived(Boolean(url) && failedUrl === url)
</script>

<Modal tag="form" onsubmit={preventDefault(() => select(url))}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add an image</ModalTitle>
      <ModalSubtitle>Upload a file, or link to an image hosted somewhere else.</ModalSubtitle>
    </ModalHeader>
    <label class="button button-primary cursor-pointer">
      <Icon icon={UploadMinimalistic} />
      Upload a file
      <input type="file" accept="image/*" class="hidden" onchange={onFileChange} />
    </label>
    <div class="flex items-center gap-3 text-sm opacity-50">
      <span class="h-px grow bg-line"></span>
      or
      <span class="h-px grow bg-line"></span>
    </div>
    <Field>
      {#snippet label()}
        <p>Image URL</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={LinkRound} />
          <input bind:value class="grow" type="url" placeholder="https://" />
        </label>
      {/snippet}
      {#snippet info()}
        {#if url && !isValid}
          <span class="text-error">Please enter a valid http or https link.</span>
        {:else if failed}
          <span class="text-error">That link could not be loaded as an image.</span>
        {:else}
          <span>The image will be linked from where it's hosted rather than re-uploaded.</span>
        {/if}
      {/snippet}
    </Field>
    {#if isValid && !failed}
      <div class="flex justify-center">
        <img
          src={url}
          alt="Preview"
          class="max-h-48 rounded-2xl object-contain"
          onerror={() => (failedUrl = url)} />
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={popModal}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!isValid}>Use this image</Button>
  </ModalFooter>
</Modal>
