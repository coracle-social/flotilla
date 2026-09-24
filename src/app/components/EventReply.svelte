<script lang="ts">
  import {onMount} from "svelte"
  import {writable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import {Comment} from "@welshman/domain"
  import {isMobile, preventDefault} from "@lib/html"
  import {fly} from "@lib/transition"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import ComposeParent from "@app/components/ComposeParent.svelte"
  import {prependParent} from "@app/rooms"
  import {makeEditor} from "@app/editor"
  import {DraftKey} from "@app/drafts"
  import {pushToast} from "@app/toast"
  import {relays, thunks, writer} from "@app/core"
  import {getSetting} from "@app/settings"

  type Values = {
    content?: string | object
  }

  type Props = {
    url: string
    event: TrustedEvent
    parent?: TrustedEvent
    onClose: () => void
    onClearParent?: () => void
    onSubmit: (thunk: unknown) => void
  }

  const {url, event, parent, onClose, onClearParent, onSubmit}: Props = $props()
  const h = $derived(tagValue(tagSpec("h"), event.tags))
  const draftKey = new DraftKey<Values>(`reply:${event.id}:${parent?.id || ""}`)
  const initialValues = draftKey.get()
  const uploading = writable(false)
  const autofocus = !isMobile

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading) {
      return
    }

    const ed = await editor
    let content = ed.getText({blockSeparator: "\n"}).trim()
    let tags = ed.storage.nostr.getEditorTags()

    if (!content) {
      return pushToast({
        theme: "error",
        message: "Please provide a message for your reply.",
      })
    }

    if (parent) {
      ;({content, tags} = await prependParent(parent, {content, tags}, url))
    }

    const eventWriter = writer(Comment)
      .setContent(content)
      .addTags(...tags)
      .setRootFromEvent(event)
      .setParentFromEvent(event)
      .setProtected(await $relays.hasNip(url, 70))

    // An untagged comment isn't visible to the group, so the relay neither gates nor deletes it with the room.
    if (h) {
      eventWriter.setRoom(url, h)
    }

    const thunk = $thunks.publish({
      relays: [url],
      event: await eventWriter.renderTemplate(),
      delay: getSetting("send_delay"),
    })

    draftKey.clear()
    onSubmit(thunk)
  }

  let form: HTMLElement
  let spacer: HTMLElement
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const empty = writable(true)

  const editor = makeEditor({url, submit, uploading, content, onChange, empty})

  $effect(() => {
    if ($empty) {
      draftKey.clear()
    } else {
      draftKey.set({content})
    }
  })

  onMount(() => {
    const observer = new ResizeObserver(() => {
      spacer!.style.minHeight = `${form!.offsetHeight + 60}px`
    })

    observer.observe(form!)

    return () => {
      observer.unobserve(form!)
    }
  })
</script>

<div bind:this={spacer}></div>
<form
  in:fly
  bind:this={form}
  onsubmit={preventDefault(submit)}
  class="left-content bottom-sai right-sai fixed z-feature mb-14 md:mb-0 w-full md:w-auto pr-2">
  <div class="card mx-2 my-2 shadow-md">
    {#if parent}
      <ComposeParent {url} event={parent} clear={() => onClearParent?.()} verb="Replying to" />
    {/if}
    <div class="relative">
      <div class="note-editor grow overflow-hidden">
        <EditorContent {autofocus} {editor} />
      </div>
      <Button
        data-tip="Add an image"
        class="tip tip-left absolute bottom-1 right-2"
        onclick={selectFiles}>
        {#if $uploading}
          <Spinner size="xs" />
        {:else}
          <Icon icon={Paperclip} size={3} />
        {/if}
      </Button>
    </div>
    <div class="flex justify-between pt-3">
      <Button class="button button-link" onclick={onClose}>Cancel</Button>
      <Button type="submit" class="button button-primary">Post Reply</Button>
    </div>
  </div>
</form>
