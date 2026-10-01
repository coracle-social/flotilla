<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {writable} from "svelte/store"
  import cx from "classnames"
  import type {MaybeAsync} from "@welshman/lib"
  import {MESSAGE} from "@welshman/util"
  import type {EventContent} from "@welshman/util"
  import {escapeHtml, isMobile, preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import WidgetAdd from "@assets/icons/widget-add.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ComposeMenu from "@app/components/ComposeMenu.svelte"
  import EditorEmojiButton from "@app/components/EditorEmojiButton.svelte"
  import DictationButton from "@app/components/DictationButton.svelte"
  import CommandArgBar from "@app/components/CommandArgBar.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {app} from "@app/core"
  import {getDictation} from "@app/dictation"
  import {pushToast} from "@app/toast"
  import {DraftKey, type Draft} from "@app/drafts"
  import type {Share} from "@app/share"

  type Props = {
    url?: string
    h?: string
    draftKey: string
    encryptFiles?: boolean
    disabled?: boolean
    initialValues?: Share
    onEscape?: () => void
    onEditPrevious?: () => void
    onSubmit: (event: EventContent) => MaybeAsync<void>
    emptyAction?: Snippet
  }

  const {
    url,
    h,
    draftKey,
    encryptFiles = false,
    disabled = false,
    initialValues,
    onEscape,
    onEditPrevious,
    onSubmit,
    emptyAction,
  }: Props = $props()

  const draft = initialValues ? undefined : new DraftKey<Draft>(draftKey)

  const autofocus = !isMobile && !disabled

  const uploading = writable(false)

  const text = writable("")

  const commandTarget = url
    ? {url, kind: MESSAGE, pubkey: $app.user?.pubkey, tags: h ? [["h", h]] : []}
    : undefined

  const buttonClass = "join-item h-10 w-10 min-w-10 button button-neutral"

  const editorClass = $derived(
    cx("chat-editor grow overflow-hidden", {
      "pointer-events-none opacity-50": disabled,
    }),
  )

  export const focus = () => editor.then(ed => ed.chain().focus().run())

  export const canEnterEditPrevious = () =>
    editor.then(ed => ed.getText({blockSeparator: "\n"}) === "")

  const handleKeyDown = async (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onEscape?.()
    }

    if (event.key === "ArrowUp" && (await canEnterEditPrevious())) {
      onEditPrevious?.()
    }
  }

  const uploadFiles = () => editor.then(ed => ed.chain().selectFiles().run())

  // Tiptap parses a string handed to insertContent as html, so an angle bracket would eat the sentence.
  const insertTranscript = async (transcript: string) => {
    const ed = await editor

    ed.chain().focus().insertContent(escapeHtml(transcript)).run()
  }

  const attachVoiceNote = async (audio: File) => {
    const ed = await editor

    ed.chain()
      .addFile(audio, ed.state.selection.from + 1)
      .run()
  }

  // Argument tokens are whitespace-delimited, so separate one from whatever precedes it.
  const insertCommandToken = async (token: string) => {
    const ed = await editor
    const separator = /\s$/.test($text) ? "" : " "

    ed.chain()
      .focus()
      .insertContent(escapeHtml(separator + token))
      .run()
  }

  const submit = async () => {
    if ($uploading || disabled || sending) {
      return
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()
    const tags = ed.storage.nostr.getEditorTags()

    sending = true

    try {
      await onSubmit({content, tags})
    } catch (error) {
      console.error("Failed to send message", error)

      return pushToast({theme: "error", message: "Failed to send your message."})
    } finally {
      sending = false
    }

    draft?.clear()
    ed.chain().clearContent(true).run()
  }

  let sending = false
  let content = $state(
    initialValues?.type === "text" ? initialValues.value : (draft?.get()?.content ?? ""),
  )
  let dictating = $state(Boolean(getDictation(draftKey)))

  const onChange = (json: object) => {
    content = json
  }

  const empty = writable(true)

  const editor = makeEditor({
    url,
    content,
    empty,
    submit,
    text,
    uploading,
    onChange,
    commandTarget,
    encryptFiles,
    aggressive: true,
  })

  $effect(() => {
    if ($empty) {
      draft?.clear()
    } else {
      draft?.set({content})
    }
  })

  onMount(async () => {
    const ed = await editor
    ed.view.dom.addEventListener("keydown", handleKeyDown)

    if (initialValues?.type === "file") {
      ed.chain()
        .addFile(initialValues.value, ed.state.selection.from + 1)
        .run()
    }
  })

  onDestroy(async () => {
    const ed = await editor
    ed?.view?.dom.removeEventListener("keydown", handleKeyDown)
  })
</script>

{#if commandTarget}
  <CommandArgBar target={commandTarget} content={$text} insert={insertCommandToken} />
{/if}
<form class="relative flex gap-2 py-2" onsubmit={preventDefault(submit)}>
  <div class="join">
    <Button
      data-tip="Add an image"
      class={buttonClass}
      disabled={$uploading || disabled}
      onclick={uploadFiles}>
      {#if $uploading}
        <Spinner size="xs" />
      {:else}
        <Icon icon={GallerySend} />
      {/if}
    </Button>
    {#if url}
      <MenuButton
        component={ComposeMenu}
        componentProps={{url, h}}
        placement="top"
        disabled={$uploading}
        class={buttonClass}>
        <Icon icon={WidgetAdd} />
      </MenuButton>
    {/if}
    <EditorEmojiButton {editor} disabled={$uploading || disabled} class={buttonClass} />
  </div>
  <div class={editorClass} aria-disabled={disabled}>
    <EditorContent {autofocus} {editor} />
  </div>
  {#if emptyAction && $empty && !dictating}
    {@render emptyAction()}
  {:else if dictating || ($empty && !disabled)}
    <DictationButton
      key={draftKey}
      bind:dictating
      onTranscript={insertTranscript}
      onVoiceNote={attachVoiceNote} />
  {:else}
    <Button
      data-tip="{window.navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}+enter to send"
      class="button button-primary button-circle flex justify-center items-center tip tip-left h-10 w-10 min-w-10"
      disabled={$uploading || disabled}
      onclick={submit}>
      <Icon icon={Plane} />
    </Button>
  {/if}
</form>
