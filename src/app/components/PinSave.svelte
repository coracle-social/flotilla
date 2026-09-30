<script lang="ts">
  import {writable} from "svelte/store"
  import {randomId} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Pin} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import {preventDefault, stopPropagation} from "@lib/html"
  import {slide} from "@lib/transition"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import CloudUpload from "@assets/icons/cloud-upload.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
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
  import RelayName from "@app/components/RelayName.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {command, reader, writer} from "@app/core"
  import {pinToReference, setPinReference, uploadFilesAsReferences} from "@app/pinboards"
  import {addressWriterToSpace} from "@app/rooms"
  import {pushToast} from "@app/toast"
  import {clearModals} from "@app/modal"

  type Props = {
    url: string
    address?: string
    reference?: string
    event?: TrustedEvent
  }

  type Fields = {
    title: string
    content: string
    topics: string[]
  }

  const {url, address, reference = "", event}: Props = $props()

  const fileInputId = randomId()
  const pin = event ? reader(Pin)(event) : undefined
  const uploading = writable(false)

  const back = () => history.back()

  const upload = async (files: File[]) => {
    $uploading = true

    try {
      const {references: uploaded, errors} = await uploadFilesAsReferences(url, files)

      value = [...references, ...uploaded].join("\n")

      if (errors.length > 0) {
        pushToast({theme: "error", message: errors.join(" ")})
      }
    } finally {
      $uploading = false
    }
  }

  const onFileChange = (e: Event) => {
    if (e.target instanceof HTMLInputElement && e.target.files?.length) {
      upload(Array.from(e.target.files))
      e.target.value = ""
    }
  }

  const onDrop = (e: Event) => {
    dropActive = false

    if (e instanceof DragEvent && e.dataTransfer?.files.length) {
      upload(Array.from(e.dataTransfer.files))
    }
  }

  const onDragOver = () => {
    dropActive = true
  }

  const onDragLeave = () => {
    dropActive = false
  }

  const savePin = async (target: string, fields: Fields) => {
    const eventWriter = await addressWriterToSpace(
      pin ? writer(Pin, pin) : writer(Pin).setIdentifier(),
      url,
    )

    if (address && !pin) {
      eventWriter.addBoard(address)
    }

    if (!setPinReference(eventWriter, target)) {
      return `${target} is not a valid URL or nostr link.`
    }

    eventWriter.setTitle(fields.title).setTopics(fields.topics).setContent(fields.content)

    const publication = await command(eventWriter).then(publish)

    return (await publication.settled()).getError()
  }

  const submit = async () => {
    loading = true

    try {
      const ed = await editor
      const content = ed.getText({blockSeparator: "\n"}).trim()

      // A title and a description are about one link, so a batch is filed with neither.
      const fields =
        references.length === 1
          ? {title, content, topics}
          : {title: "", content: "", topics: [] as string[]}

      const errors = await Promise.all(references.map(target => savePin(target, fields)))
      const error = errors.find(Boolean)

      if (error) {
        pushToast({theme: "error", message: error})
      } else if (pin) {
        pushToast({message: "Link updated!"})
        clearModals()
      } else if (references.length > 1) {
        pushToast({message: `${references.length} links added!`})
        clearModals()
      } else {
        pushToast({message: "Link added!"})
        clearModals()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to save the link."})
    } finally {
      loading = false
    }
  }

  const editor = makeEditor({url, submit, uploading, content: pin?.content() ?? ""})

  const selectFiles = () => editor.then(ed => ed.chain().selectFiles().run())

  let title = $state(pin?.title() ?? "")
  let topics = $state<string[]>(pin?.topics() ?? [])
  let value = $state(pin ? pinToReference(pin) : reference)
  let loading = $state(false)
  let dropActive = $state(false)

  const references = $derived(value.split(/\s+/).filter(Boolean))
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>
        {#if pin}
          Edit Link
        {:else}
          Add a Link
        {/if}
      </ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Link
      {/snippet}
      {#snippet info()}
        <p>
          A URL or a nostr link (note, nevent, naddr, npub, or nprofile). Drop files here to upload
          them. Paste several links, one per line, to file them all at once.
        </p>
      {/snippet}
      {#snippet input()}
        <div
          class="flex flex-col gap-2"
          role="presentation"
          ondragover={stopPropagation(preventDefault(onDragOver))}
          ondragleave={stopPropagation(preventDefault(onDragLeave))}
          ondrop={stopPropagation(preventDefault(onDrop))}>
          <textarea
            bind:value
            rows={pin ? 2 : 3}
            class="textarea input w-full"
            style:border-color={dropActive ? "var(--primary)" : undefined}
            placeholder="URL or nevent..."></textarea>
          {#if !pin}
            <label
              for={fileInputId}
              class="button button-neutral button-sm cursor-pointer self-start">
              {#if $uploading}
                <Spinner size="xs" />
              {:else}
                <Icon size={4} icon={CloudUpload} />
              {/if}
              Upload files
            </label>
            <input id={fileInputId} type="file" multiple class="hidden" onchange={onFileChange} />
          {/if}
        </div>
      {/snippet}
    </Field>
    {#if references.length > 1}
      <p transition:slide class="card card-sm text-sm opacity-75">
        {references.length} links, each filed on its own. A title and a description describe one link,
        so add them from its menu once it is on the shelf.
      </p>
    {:else if references.length === 1}
      <div transition:slide class="card card-sm flex flex-col gap-4 opacity-75">
        <Field>
          {#snippet label()}
            Title
          {/snippet}
          {#snippet input()}
            <input bind:value={title} class="input w-full" placeholder="Optional title" />
          {/snippet}
        </Field>
        <Field>
          {#snippet label()}
            Description
          {/snippet}
          {#snippet input()}
            <div class="relative z-feature flex gap-2">
              <div class="input-editor grow overflow-hidden">
                <EditorContent {editor} />
              </div>
              <Button
                data-tip="Add an image"
                class="button button-neutral button-input tip"
                onclick={selectFiles}
                disabled={loading}>
                {#if $uploading}
                  <Spinner size="xs" />
                {:else}
                  <Icon icon={GallerySend} />
                {/if}
              </Button>
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
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      onclick={submit}
      disabled={loading || $uploading || references.length === 0}>
      <Spinner {loading}>
        {#if pin}
          Save changes
        {:else if references.length > 1}
          Add {references.length} links
        {:else}
          Add link
        {/if}
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
