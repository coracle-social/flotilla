<script lang="ts">
  import {getAddress} from "@welshman/util"
  import {publish} from "@welshman/app"
  import {Pinboard} from "@welshman/domain"
  import type {PinboardReader} from "@welshman/domain"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import StringMultiInput from "@lib/components/StringMultiInput.svelte"
  import ImageInputButton from "@app/components/ImageInputButton.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {command, writer} from "@app/core"
  import {navigate} from "@app/modal"
  import {addressWriterToSpace} from "@app/rooms"
  import {makeLibraryPath} from "@app/routes"
  import {pushToast} from "@app/toast"
  import {resolveImageInput} from "@app/uploads"

  type Props = {
    url: string
    board?: PinboardReader
  }

  const {url, board}: Props = $props()

  const back = () => history.back()

  const onImageSelect = (selected: File | string) => {
    if (typeof selected === "string") {
      imageFile = undefined
      image = selected
    } else {
      imageFile = selected
      image = URL.createObjectURL(selected)
    }
  }

  const clearImage = () => {
    imageFile = undefined
    image = ""
  }

  const submit = async () => {
    loading = true

    try {
      const eventWriter = await addressWriterToSpace(
        writer(Pinboard, board)
          .setTitle(title)
          .setDescription(description)
          .setImage((await resolveImageInput(imageFile, image)) ?? "")
          .setTopics(topics),
        url,
      )

      if (!board) {
        eventWriter.setIdentifier().setCollaborative(true)
      }

      const publication = await command(eventWriter).then(publish)
      const error = await publication.getError()

      if (error) {
        pushToast({theme: "error", message: error})
      } else if (board) {
        pushToast({message: "Shelf updated!"})
        back()
      } else {
        pushToast({message: "Shelf created!"})
        navigate(makeLibraryPath(url, getAddress(publication.event)))
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "This space refused to save the shelf."})
    } finally {
      loading = false
    }
  }

  let title = $state(board?.title() ?? "")
  let description = $state(board?.description() ?? "")
  let topics = $state<string[]>(board?.topics() ?? [])
  let image = $state(board?.image() ?? "")
  let imageFile = $state<File>()
  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{board ? "Edit Shelf" : "Create Shelf"}</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Title
      {/snippet}
      {#snippet input()}
        <input bind:value={title} class="input w-full" placeholder="Shelf title" />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Description
      {/snippet}
      {#snippet input()}
        <input
          bind:value={description}
          class="input w-full"
          placeholder="What's this shelf about?" />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Cover image
      {/snippet}
      {#snippet input()}
        <div class="flex items-center gap-3">
          {#if image}
            <img src={image} alt="" class="h-16 w-24 rounded-2xl object-cover" />
          {/if}
          <ImageInputButton
            onSelect={onImageSelect}
            initialValue={imageFile ? undefined : image}
            aria-label="Add a cover image"
            class="button button-neutral button-sm">
            <Icon icon={UploadMinimalistic} size={4} />
            {image ? "Replace" : "Add an image"}
          </ImageInputButton>
          {#if image}
            <Button class="button button-link button-sm" onclick={clearImage}>Remove</Button>
          {/if}
        </div>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Topics
      {/snippet}
      {#snippet input()}
        <StringMultiInput bind:value={topics} placeholder="Add a topic..." />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={loading || !title.trim()}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
