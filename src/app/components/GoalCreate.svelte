<script lang="ts">
  import {writable} from "svelte/store"
  import {relay} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
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
  import {pushToast} from "@app/toast"
  import {publishRoomQuote} from "@app/rooms"
  import {makeEditor} from "@app/editor"
  import {DraftKey} from "@app/drafts"

  type Values = {
    title: string
    content: string | object
    amount: number
  }

  type Props = {
    url: string
    h?: string
    initialValues?: Values
    shareToChat?: boolean
  }

  let {url, h, initialValues, shareToChat = false}: Props = $props()

  const draftKey = new DraftKey<Values>(`goal:${url}:${h ?? ""}`)

  if (!initialValues) {
    initialValues = draftKey.get()
  }

  const shouldProtect = $relays.hasNip(url, 70)

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading || loading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your funding goal.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content.trim()) {
      return pushToast({
        theme: "error",
        message: "Please provide details about your funding goal.",
      })
    }

    loading = true

    try {
      const protect = await shouldProtect
      const eventWriter = writer(ZapGoal)
        .setTitle(title)
        .setSummary(content)
        .setAmount(amount)
        .setUrls([url])
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())
        .forceRoutes(relay(url))

      if (h) {
        eventWriter.setRoom(url, h)
      }

      const goalThunk = await command(eventWriter).then(publish)
      const error = await goalThunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()

      if (shareToChat) {
        publishRoomQuote({url, h, parent: goalThunk.event, protect})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  let title = $state(initialValues?.title ?? "")
  let amount = $state(initialValues?.amount ?? 1000)
  let content = $state(initialValues?.content ?? "")

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
    draftKey.update({title, content, amount})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Funding Goal</ModalTitle>
      <ModalSubtitle>Request contributions for your fundraiser.</ModalSubtitle>
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
              placeholder="What do funds go towards?" />
          </label>
        {/snippet}
      </Field>
      <div class="relative">
        <Field>
          {#snippet label()}
            <p>Details*</p>
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
      <div class="flex flex-col gap-3">
        <FieldInline>
          {#snippet label()}
            Goal Amount (sats)*
          {/snippet}
          {#snippet input()}
            <div class="flex grow justify-end">
              <label class="input flex w-auto items-center gap-2">
                <Icon icon={Bolt} />
                <input bind:value={amount} type="number" class="w-28 grow" />
                <p class="shrink-0 opacity-50">sats</p>
              </label>
            </div>
          {/snippet}
        </FieldInline>
        <input
          class="range w-full"
          type="range"
          min="1000"
          max="100000"
          step="1000"
          bind:value={amount} />
      </div>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$uploading || loading}>
      <Spinner {loading}>Create Goal</Spinner>
    </Button>
  </ModalFooter>
</Modal>
