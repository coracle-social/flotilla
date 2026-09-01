<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import type {RelayInfo} from "@welshman/domain"
  import Widget from "@assets/icons/widget-4.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
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
  import IconInput from "@lib/components/IconInput.svelte"
  import {pushToast} from "@app/toast"
  import {clearModals} from "@app/modal"
  import {resolveImageInput} from "@app/uploads"
  import {relayManagement, relays} from "@app/core"

  type Props = {
    url: string
    initialValues: Partial<RelayInfo>
  }

  const {url, initialValues = {}}: Props = $props()

  const values = $state({...initialValues})

  const compressOptions = {maxWidth: 128, maxHeight: 128}

  const back = () => history.back()

  const submit = async () => {
    if (values.name != initialValues.name) {
      const res = await $relayManagement.forUrl(url).changeRelayName(values.name || "")

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    if (values.description != initialValues.description) {
      const res = await $relayManagement
        .forUrl(url)
        .changeRelayDescription(values.description || "")

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    const icon = await resolveImageInput(imageFile, imagePreview, compressOptions)

    if (icon && icon !== initialValues.icon) {
      const res = await $relayManagement.forUrl(url).changeRelayIcon(icon)

      if (res.error) {
        return pushToast({theme: "error", message: res.error})
      }
    }

    pushToast({message: "Your changes have been saved!"})
    $relays.forceLoad(url)
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
</script>

<Modal tag="form" onsubmit={preventDefault(trySubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Edit this Space</ModalTitle>
      <ModalSubtitle><span class="text-primary">{displayRelayUrl(url)}</span></ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>Icon</p>
      {/snippet}
      {#snippet input()}
        <IconInput bind:file={imageFile} bind:preview={imagePreview} />
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Name</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          {#if imagePreview}
            <ImageIcon src={imagePreview} alt="" />
          {:else}
            <Icon icon={Widget} />
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
        <textarea bind:value={values.description} class="min-h-24 textarea input flex w-full"
        ></textarea>
      {/snippet}
    </FieldInline>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Save Changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
