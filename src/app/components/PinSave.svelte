<script lang="ts">
  import cx from "classnames"
  import {writable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {Pin} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
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
  import RelayName from "@app/components/RelayName.svelte"
  import EditorContent from "@app/features/editor/EditorContent.svelte"
  import {makeEditor} from "@app/features/editor"
  import {command, reader, writer} from "@app/core/domain"
  import {parsePinReference, pinToReference} from "@app/features/pinboards"
  import {addressWriterToSpace} from "@app/features/rooms"
  import {compressFileForUpload, uploadFile} from "@app/core/uploads"
  import {pushToast} from "@app/ui/toast"
  import {clearModals} from "@app/ui/modal"

  type Props = {
    url: string
    address?: string
    reference?: string
    event?: TrustedEvent
  }

  const {url, address, reference = "", event}: Props = $props()

  const pin = event ? reader(Pin)(event) : undefined
  const uploading = writable(false)

  const back = () => history.back()

  const onFileChange = async (e: Event & {currentTarget: HTMLInputElement}) => {
    const file = e.currentTarget.files?.[0]

    if (file) {
      e.currentTarget.value = ""
      uploadingLink = true

      try {
        const {result, error} = await uploadFile(await compressFileForUpload(file), {url})

        if (result) {
          value = result.url
        } else {
          pushToast({theme: "error", message: error ?? `${file.name} could not be uploaded.`})
        }
      } catch (e) {
        console.error(e)
        pushToast({theme: "error", message: `${file.name} could not be uploaded.`})
      } finally {
        uploadingLink = false
      }
    }
  }

  const submit = async () => {
    if (pinReference) {
      loading = true

      try {
        const ed = await editor
        const eventWriter = await addressWriterToSpace(
          pin ? writer(Pin, pin) : writer(Pin).setIdentifier(),
          url,
        )

        if (address && !pin) {
          eventWriter.addBoard(address)
        }

        eventWriter
          .setReference(pinReference)
          .setTitle(title)
          .setTopics(topics)
          .setContent(ed.getText({blockSeparator: "\n"}).trim())

        const publication = await command(eventWriter).then(publish)
        const error = await publication.getError()

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: pin ? "Link updated!" : "Link added!"})
          clearModals()
        }
      } catch (e) {
        console.error(e)
        pushToast({theme: "error", message: "Failed to save the link."})
      } finally {
        loading = false
      }
    }
  }

  const editor = makeEditor({url, submit, uploading, content: pin?.content() ?? ""})

  const selectFiles = () => editor.then(ed => ed.chain().selectFiles().run())

  let title = $state(pin?.title() ?? "")
  let topics = $state<string[]>(pin?.topics() ?? [])
  let value = $state(pin ? pinToReference(pin) : reference)
  let loading = $state(false)
  let uploadingLink = $state(false)

  const pinReference = $derived(parsePinReference(value))
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
        {#if value.trim() && !pinReference}
          <span class="text-error">Please enter a valid URL or nostr link.</span>
        {:else}
          <span>A URL or a nostr link, or upload a file.</span>
        {/if}
      {/snippet}
      {#snippet input()}
        <div class="flex gap-2">
          <label class="input flex min-w-0 grow items-center gap-2">
            <Icon icon={LinkRound} />
            <input bind:value class="grow" aria-label="Link" placeholder="https://..." />
          </label>
          <label
            class={cx("button button-neutral button-input", {
              "button-disabled": loading || uploadingLink,
            })}>
            {#if uploadingLink}
              <Spinner size="xs" />
            {:else}
              <Icon icon={UploadMinimalistic} size={4} />
            {/if}
            Upload
            <input
              type="file"
              class="hidden"
              disabled={loading || uploadingLink}
              onchange={onFileChange} />
          </label>
        </div>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Title
      {/snippet}
      {#snippet input()}
        <input bind:value={title} class="input w-full" aria-label="Title" />
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
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      onclick={submit}
      disabled={loading || uploadingLink || $uploading || !pinReference}>
      <Spinner {loading}>
        {#if pin}
          Save changes
        {:else}
          Add link
        {/if}
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
