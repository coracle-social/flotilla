<script lang="ts">
  import {writable} from "svelte/store"
  import {uniq} from "@welshman/lib"
  import {Note} from "@welshman/domain"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {publisher, writer} from "@app/core"
  import {DraftKey} from "@app/drafts"
  import {makeEditor} from "@app/editor"
  import {userSpaceUrls} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Values = {
    content?: string | object
  }

  const draftKey = new DraftKey<Values>("note")
  const draft = draftKey.get()

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading || loading) {
      return
    }

    const ed = await editor
    const text = ed.getText({blockSeparator: "\n"}).trim()

    if (!text) {
      return pushToast({theme: "error", message: "Please write something first."})
    }

    loading = true

    try {
      const {event, relays} = await writer(Note)
        .setContent(text)
        .addTags(...ed.storage.nostr.getEditorTags())
        .render()

      const publication = $publisher.publish({
        event,
        relays: uniq([...relays, ...$userSpaceUrls]),
      })

      const error = (await publication.settled()).getError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let content = $state(draft?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    submit,
    uploading,
    onChange,
    content,
    placeholder: "What's on your mind?",
  })

  $effect(() => {
    draftKey.update({content})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Public Post</ModalTitle>
      <ModalSubtitle>Published to your outbox and all favorited spaces.</ModalSubtitle>
    </ModalHeader>
    <div class="relative">
      <div class="note-editor grow overflow-hidden">
        <EditorContent autofocus={!isMobile} {editor} />
      </div>
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
      <Spinner {loading}>Post</Spinner>
    </Button>
  </ModalFooter>
</Modal>
