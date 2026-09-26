<script lang="ts">
  import {writable} from "svelte/store"
  import {Pin} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import type {PinReader} from "@welshman/domain"
  import {slide} from "@lib/transition"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
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
  import {command, writer} from "@app/core"
  import {pinToReference, setPinReference} from "@app/pinboards"
  import {toSpace} from "@app/rooms"
  import {pushToast} from "@app/toast"
  import {clearModals} from "@app/modal"

  type Props = {
    url: string
    address?: string
    reference?: string
    pin?: PinReader
  }

  const {url, address, reference = "", pin}: Props = $props()

  let title = $state(pin?.title() ?? "")
  let topics = $state<string[]>(pin?.topics() ?? [])
  let value = $state(pin ? pinToReference(pin) : reference)
  let content = $state<string | object>(pin?.content() ?? "")
  let loading = $state(false)

  const uploading = writable(false)

  const back = () => history.back()

  const submit = async () => {
    const eventWriter = await toSpace(
      address ? writer(Pin).setIdentifier().addBoard(address) : writer(Pin, pin),
      url,
    )

    if (!setPinReference(eventWriter, value)) {
      return "Please enter a valid URL or nostr link."
    }

    const ed = await editor

    eventWriter
      .setTitle(title)
      .setTopics(topics)
      .setContent(ed.getText({blockSeparator: "\n"}).trim())

    const thunk = await command(eventWriter).then(publish)

    return thunk.waitForError()
  }

  const onSubmit = async () => {
    loading = true

    try {
      const error = await submit()

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: pin ? "Link updated!" : "Link added!"})
        clearModals()
      }
    } finally {
      loading = false
    }
  }

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({url, submit: onSubmit, uploading, onChange, content})

  const selectFiles = () => editor.then(ed => ed.chain().selectFiles().run())
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>
        {#if pin}
          Edit Link
        {:else}
          Add Link
        {/if}
      </ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Link
      {/snippet}
      {#snippet info()}
        <p>A URL or nostr link (note, nevent, naddr, npub, or nprofile).</p>
      {/snippet}
      {#snippet input()}
        <input bind:value class="input w-full" placeholder="URL or nevent..." />
      {/snippet}
    </Field>
    {#if value.trim()}
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
      onclick={onSubmit}
      disabled={loading || $uploading || !value.trim()}>
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
