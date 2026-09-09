<script lang="ts">
  import {writable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {relay} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {command, relays, writer} from "@app/core"
  import {DraftKey} from "@app/drafts"
  import {makeEditor} from "@app/editor"
  import {displayRoom, publishRoomQuote} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Values = {
    content?: string | object
    title?: string
    h?: string
  }

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
    quote?: TrustedEvent
    initialValues?: Values
  }

  const {url, h, shareToChat = false, quote, initialValues}: Props = $props()
  const draftKey = new DraftKey<Values>(`thread:${url}:${h ?? ""}`)
  const draft = draftKey.get()
  const shouldProtect = $relays.hasNip(url, 70)
  const room = h ?? initialValues?.h ?? draft?.h ?? ""

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading || loading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your thread.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content) {
      return pushToast({
        theme: "error",
        message: "Please provide a message for your thread.",
      })
    }

    loading = true

    try {
      const protect = await shouldProtect
      const eventWriter = writer(Thread)
        .setContent(content)
        .setTitle(title)
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())
        .forceRoutes(relay(url))

      if (room) {
        eventWriter.setRoom(url, room)
      }

      if (quote) {
        eventWriter.addQuote(quote)
      }

      const thunk = await command(eventWriter).then(publish)
      const error = await thunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()

      if (shareToChat) {
        publishRoomQuote({url, h: room, parent: thunk.event, protect})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  let title = $state(initialValues?.title ?? draft?.title ?? "")
  let content = $state(initialValues?.content ?? draft?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    url,
    submit,
    uploading,
    onChange,
    placeholder: "What's on your mind?",
    content,
  })

  $effect(() => {
    draftKey.update({title, content, h: room})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Thread</ModalTitle>
      <ModalSubtitle>
        Share a link, or start a discussion in {room ? displayRoom(url, room) : "General"}.
      </ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-8 relative">
      <Field>
        {#snippet label()}
          <p>Title*</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus={!isMobile}
              bind:value={title}
              class="grow"
              type="text"
              placeholder="What is this thread about?" />
          </label>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Message*</p>
        {/snippet}
        {#snippet input()}
          <div class="note-editor grow overflow-hidden">
            <EditorContent {editor} />
          </div>
        {/snippet}
      </Field>
      <Button
        data-tip="Add an image"
        class="tip tip-left absolute bottom-1 right-2"
        onclick={selectFiles}
        disabled={loading}>
        {#if $uploading}
          <Spinner size="xs" />
        {:else}
          <Icon icon={Paperclip} size={3} />
        {/if}
      </Button>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$uploading || loading}>
      <Spinner {loading}>Create Thread</Spinner>
    </Button>
  </ModalFooter>
</Modal>
