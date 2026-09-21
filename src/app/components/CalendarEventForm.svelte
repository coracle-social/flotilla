<script lang="ts">
  import type {Snippet} from "svelte"
  import {writable} from "svelte/store"
  import {randomId} from "@welshman/lib"
  import {relay} from "@welshman/util"
  import {publish} from "@welshman/app"
  import {TimeEvent} from "@welshman/domain"
  import {preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import DateTimeRangeInput from "@lib/components/DateTimeRangeInput.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {publishRoomQuote} from "@app/rooms"
  import {makeEditor} from "@app/editor"
  import {DraftKey} from "@app/drafts"
  import {pushToast} from "@app/toast"
  import {command, relays, writer} from "@app/core"

  type Values = {
    d: string
    title: string
    content: string | object
    location: string
    start?: number
    end?: number
  }

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
    header: Snippet
    initialValues?: Values
    defaultStart?: number
    defaultEnd?: number
  }

  let {
    url,
    h,
    shareToChat = false,
    header,
    initialValues,
    defaultStart,
    defaultEnd,
  }: Props = $props()

  const draftKey = new DraftKey<Values>(`calendar:${url}:${h ?? ""}`)

  if (!initialValues) {
    initialValues = draftKey.get()
  }

  const shouldProtect = $relays.hasNip(url, 70)

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.chain().selectFiles().run())

  const submit = async () => {
    if ($uploading || loading) {
      return
    }

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title.",
      })
    }

    if (!start || !end) {
      return pushToast({
        theme: "error",
        message: "Please provide start and end times.",
      })
    }

    if (start >= end) {
      return pushToast({
        theme: "error",
        message: "End time must be later than start time.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    loading = true

    try {
      const protect = await shouldProtect
      const eventWriter = writer(TimeEvent)
        .setIdentifier(d)
        .setTitle(title)
        .setLocation(location)
        .setStart(start)
        .setEnd(end)
        .setContent(content)
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())

      if (h) {
        eventWriter.setRoom(url, h)
      } else {
        eventWriter.forceRoutes(relay(url))
      }

      const calendarThunk = await command(eventWriter).then(publish)
      const error = await calendarThunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()

      if (shareToChat) {
        publishRoomQuote({url, h, parent: calendarThunk.event, protect})
      }

      pushToast({message: "Your event has been saved!"})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  const d = $state(initialValues?.d ?? randomId())
  let title = $state(initialValues?.title ?? "")
  let location = $state(initialValues?.location ?? "")
  // A day chosen before the form opened is more current than whatever the draft was left on
  let start: number | undefined = $state(defaultStart ?? initialValues?.start)
  let end: number | undefined = $state(defaultEnd ?? initialValues?.end)
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({url, submit, uploading, onChange, content})

  $effect(() => {
    draftKey.set({d, title, location, start, end, content})
  })
</script>

<Modal tag="form" novalidate onsubmit={preventDefault(submit)}>
  <ModalBody>
    {@render header()}
    <Field>
      {#snippet label()}
        <p>Title*</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <input bind:value={title} class="grow" type="text" />
        </label>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        <p>Summary</p>
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
        <p>Date and time*</p>
      {/snippet}
      {#snippet input()}
        <DateTimeRangeInput bind:start bind:end />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        <p>Location (optional)</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={MapPoint} />
          <input bind:value={location} class="grow" type="text" />
        </label>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" type="submit" disabled={$uploading || loading}>
      <Spinner loading={$uploading || loading}>Save Event</Spinner>
    </Button>
  </ModalFooter>
</Modal>
