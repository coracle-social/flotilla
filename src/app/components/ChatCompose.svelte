<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {writable} from "svelte/store"
  import cx from "classnames"
  import type {MaybeAsync} from "@welshman/lib"
  import type {EventContent} from "@welshman/util"
  import {escapeHtml, isMobile, preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import DictationButton from "@app/components/DictationButton.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {getDictation} from "@app/dictation"
  import {type DraftKey, type Draft} from "@app/drafts"
  import {pushToast} from "@app/toast"
  import type {Share} from "@app/share"

  type Props = {
    disabled?: boolean
    dictationKey: string
    draftKey?: DraftKey<Draft>
    onEscape?: () => void
    onEditPrevious?: () => void
    onSubmit: (event: EventContent) => MaybeAsync<void>
    initialValues?: Share
  }

  const {
    initialValues,
    disabled = false,
    dictationKey,
    draftKey,
    onEscape,
    onEditPrevious,
    onSubmit,
  }: Props = $props()

  const autofocus = !isMobile && !disabled

  const uploading = writable(false)

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

  // Tiptap parses a string handed to insertContent as html, so an angle bracket in the
  // transcript would eat the rest of the sentence.
  const insertTranscript = async (text: string) => {
    const ed = await editor

    ed.chain().focus().insertContent(escapeHtml(text)).run()
  }

  const submit = async () => {
    if ($uploading || disabled) return

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()
    const tags = ed.storage.nostr.getEditorTags()

    if (!content) return

    try {
      await onSubmit({content, tags})
    } catch (error) {
      console.error("Failed to send message", error)

      return pushToast({theme: "error", message: "Failed to send your message."})
    }

    draftKey?.clear()
    ed.chain().clearContent(true).run()
  }

  let content = $state(
    initialValues?.type === "text" ? initialValues.value : (draftKey?.get()?.content ?? ""),
  )
  let dictating = $state(Boolean(getDictation(dictationKey)))

  const onChange = (json: object) => {
    content = json
  }

  const empty = writable(true)

  const editor = makeEditor({
    content,
    empty,
    submit,
    uploading,
    onChange,
    aggressive: true,
    encryptFiles: true,
  })

  $effect(() => {
    if ($empty) {
      draftKey?.clear()
    } else {
      draftKey?.set({content})
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

<form class="relative z-feature flex gap-2 p-2" onsubmit={preventDefault(submit)}>
  <Button
    data-tip="Add an image"
    class="button button-neutral button-square tip tip-right h-10 w-10 min-w-10 rounded-2xl transition-colors"
    disabled={$uploading || disabled}
    onclick={uploadFiles}>
    {#if $uploading}
      <Spinner size="xs" />
    {:else}
      <Icon icon={GallerySend} />
    {/if}
  </Button>
  <div class={editorClass} aria-disabled={disabled}>
    <EditorContent {autofocus} {editor} />
  </div>
  {#if dictating || ($empty && !disabled)}
    <DictationButton key={dictationKey} bind:dictating onTranscript={insertTranscript} />
  {:else}
    <Button
      data-tip="{window.navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}+enter to send"
      class="button button-primary button-circle tip tip-left h-10 w-10 min-w-10"
      disabled={$uploading || disabled}
      onclick={submit}>
      <Icon icon={Plane} />
    </Button>
  {/if}
</form>
