<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {writable} from "svelte/store"
  import cx from "classnames"
  import type {MaybeAsync} from "@welshman/lib"
  import type {EventContent} from "@welshman/util"
  import {isMobile, preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {type DraftKey, type Draft} from "@app/drafts"
  import {pushToast} from "@app/toast"
  import type {Share} from "@app/share"

  type Props = {
    disabled?: boolean
    draftKey?: DraftKey<Draft>
    onEscape?: () => void
    onEditPrevious?: () => void
    onSubmit: (event: EventContent) => MaybeAsync<void>
    initialValues?: Share
  }

  const {
    initialValues,
    disabled = false,
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
    ed.chain().clearContent().run()
  }

  let content = $state(
    initialValues?.type === "text" ? initialValues.value : (draftKey?.get()?.content ?? ""),
  )

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    content,
    submit,
    uploading,
    onChange,
    aggressive: true,
    encryptFiles: true,
  })

  $effect(() => {
    draftKey?.set({content})
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
  <Button
    data-tip="{window.navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}+enter to send"
    class="button button-primary button-circle tip tip-left h-10 w-10 min-w-10"
    disabled={$uploading || disabled}
    onclick={submit}>
    <Icon icon={Plane} />
  </Button>
</form>
