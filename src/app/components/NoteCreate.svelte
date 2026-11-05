<script lang="ts">
  import {writable} from "svelte/store"
  import {Note} from "@welshman/domain"
  import {isMobile} from "@lib/html"
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
  import EditorContent from "@app/features/editor/EditorContent.svelte"
  import {writer} from "@app/core/domain"
  import {DraftKey} from "@app/features/drafts"
  import {makeEditor} from "@app/features/editor"
  import {publishToNetwork} from "@app/features/social"
  import {pushToast} from "@app/features/toast"
  import {openEventNote} from "@app/navigation/overlays"
  import PublishButton from "@app/components/PublishButton.svelte"

  type Values = {
    content?: string | object
  }

  type Props = {
    initialValues?: Values
  }

  const {initialValues}: Props = $props()

  const draftKey = new DraftKey<Values>("note")
  const draft = draftKey.get()

  const uploading = writable(false)

  const empty = writable(true)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const publish = async (scheduleAt?: number) => {
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
      const {publication, error} = await publishToNetwork(
        writer(Note)
          .setContent(text)
          .addTags(...ed.storage.nostr.getEditorTags()),
        scheduleAt,
      )

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()
      pushToast({
        message: scheduleAt
          ? `Your post is scheduled for ${new Date(scheduleAt * 1000).toLocaleString([], {dateStyle: "medium", timeStyle: "short"})}.`
          : "Your post has been published!",
        action: {message: "View it", onclick: () => openEventNote(publication.event)},
      })
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to post."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let content = $state(initialValues?.content ?? draft?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    submit: publish,
    empty,
    uploading,
    onChange,
    content,
    placeholder: "What's on your mind?",
  })

  $effect(() => {
    draftKey.update({content})
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Public Post</ModalTitle>
      <ModalSubtitle>Broadcast to the wider network.</ModalSubtitle>
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
    <PublishButton onPublish={publish} disabled={$uploading || loading || $empty}>
      <Spinner {loading}>Post</Spinner>
    </PublishButton>
  </ModalFooter>
</Modal>
