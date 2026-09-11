<script lang="ts">
  import {writable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import {publishToRelays} from "@welshman/app"
  import {Comment} from "@welshman/domain"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {command, relays, writer} from "@app/core"
  import {DraftKey} from "@app/drafts"
  import {makeEditor} from "@app/editor"
  import {pushToast} from "@app/toast"

  type Values = {
    content?: string | object
  }

  type Props = {
    url: string
    event: TrustedEvent
    parent?: TrustedEvent
    onCancel: () => void
    onSubmit: () => void
  }

  const {url, event, parent, onCancel, onSubmit}: Props = $props()

  const h = $derived(tagValue(tagSpec("h"), event.tags))

  const draftKey = new DraftKey<Values>(`comment:${event.id}:${parent?.id ?? ""}`)
  const initialValues = draftKey.get()
  const uploading = writable(false)

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading || loading) return

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content) {
      return pushToast({theme: "error", message: "Please write something first."})
    }

    loading = true

    try {
      const eventWriter = writer(Comment)
        .setContent(content)
        .addTags(...ed.storage.nostr.getEditorTags())
        .setRootFromEvent(event)
        .setParentFromEvent(parent ?? event)
        .setProtected(await $relays.hasNip(url, 70))

      // A comment on a room event is a room event too: an untagged one isn't visible to the
      // group at all, so the relay neither gates it with the room nor deletes it with it.
      if (h) {
        eventWriter.setRoom(url, h)
      }

      const thunk = await command(eventWriter).then(publishToRelays([url]))
      const error = await thunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      onSubmit()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const empty = writable(true)

  const editor = makeEditor({
    url,
    submit,
    uploading,
    onChange,
    content,
    empty,
    placeholder: parent ? "Write a reply..." : "Write a comment...",
  })

  $effect(() => {
    if ($empty) {
      draftKey.clear()
    } else {
      draftKey.set({content})
    }
  })
</script>

<form
  onsubmit={preventDefault(submit)}
  class="border-line flex flex-col gap-2 rounded-2xl border border-solid p-3">
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
  <div class="flex justify-end gap-2">
    <Button class="button button-link" onclick={onCancel} disabled={loading}>Cancel</Button>
    <Button type="submit" class="button button-primary button-sm" disabled={$uploading || loading}>
      <Spinner {loading}>
        {#if parent}
          Reply
        {:else}
          Comment
        {/if}
      </Spinner>
    </Button>
  </div>
</form>
