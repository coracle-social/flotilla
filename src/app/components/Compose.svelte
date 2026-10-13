<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {writable} from "svelte/store"
  import cx from "classnames"
  import type {MaybeAsync} from "@welshman/lib"
  import {MESSAGE} from "@welshman/util"
  import type {EventContent} from "@welshman/util"
  import {escapeHtml, isMobile, preventDefault} from "@lib/html"
  import Add from "@assets/icons/add.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ComposeMenu from "@app/components/ComposeMenu.svelte"
  import EditorEmojiButton from "@app/components/EditorEmojiButton.svelte"
  import DictationButton from "@app/components/DictationButton.svelte"
  import CommandArgBar from "@app/components/CommandArgBar.svelte"
  import EditorContent from "@app/features/editor/EditorContent.svelte"
  import {makeEditor} from "@app/features/editor"
  import {app} from "@app/core/app"
  import {getDictation} from "@app/features/dictation"
  import {pushToast} from "@app/ui/toast"
  import {DraftKey, type Draft} from "@app/features/drafts"
  import type {Share} from "@app/ui/share"

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

  const buttonClass = "button button-ghost button-circle"

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
    placeholder: "Message",
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
<form class="relative flex items-end gap-1 py-2" onsubmit={preventDefault(submit)}>
  {#if url}
    <MenuButton
      component={ComposeMenu}
      componentProps={{url, h, uploadFiles}}
      placement="top-start"
      aria-label="Attach or create"
      disabled={$uploading || disabled}
      class={buttonClass}>
      {@render addIcon()}
    </MenuButton>
  {:else}
    <Button
      aria-label="Attach a photo or file"
      class={buttonClass}
      disabled={$uploading || disabled}
      onclick={uploadFiles}>
      {@render addIcon()}
    </Button>
  {/if}
  <EditorEmojiButton {editor} disabled={$uploading || disabled} class={buttonClass} />
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
      class="button button-primary button-circle tip tip-left"
      disabled={$uploading || disabled}
      onclick={submit}>
      <Icon icon={Plane} />
    </Button>
  {/if}
</form>

{#snippet addIcon()}
  {#if $uploading}
    <Spinner size="xs" />
  {:else}
    <Icon icon={Add} />
  {/if}
{/snippet}
