<script lang="ts">
  import {writable} from "svelte/store"
  import type {Maybe} from "@welshman/lib"
  import type {EventContent} from "@welshman/util"
  import {escapeHtml, isMobile, preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import WidgetAdd from "@assets/icons/widget-add.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ComposeMenu from "@app/components/ComposeMenu.svelte"
  import DictationButton from "@app/components/DictationButton.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {DraftKey, type Draft} from "@app/drafts"
  import type {Share} from "@app/share"
  import {onDestroy, onMount} from "svelte"

  type Props = {
    url?: string
    h?: string
    onEscape?: () => void
    onEditPrevious?: () => void
    onSubmit: (event: EventContent) => void
    initialValues?: Share
  }

  const {url, h, initialValues, onEscape, onEditPrevious, onSubmit}: Props = $props()

  const draftKey =
    (url || h) && !initialValues ? new DraftKey<Draft>(`room:${url ?? ""}:${h ?? ""}`) : undefined

  const autofocus = !isMobile

  const uploading = writable(false)

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

  const showPopover = () => tippy?.show()

  const hidePopover = () => tippy?.hide()

  const submit = async () => {
    if ($uploading) return

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()
    const tags = ed.storage.nostr.getEditorTags()

    onSubmit({content, tags})

    draftKey?.clear()
    ed.chain().clearContent(true).run()
  }

  let tippy: Maybe<TippyController> = $state()
  let content = $state(
    initialValues?.type === "text" ? initialValues.value : (draftKey?.get()?.content ?? ""),
  )
  let recording = $state(false)

  const onChange = (json: object) => {
    content = json
  }

  const empty = writable(true)

  const editor = makeEditor({
    url,
    content,
    empty,
    submit,
    uploading,
    onChange,
    aggressive: true,
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

<form class="relative flex gap-2 py-2" onsubmit={preventDefault(submit)}>
  <div class="join">
    <Button
      class="join-item h-10 w-10 min-w-10 button button-neutral"
      disabled={$uploading}
      onclick={uploadFiles}>
      {#if $uploading}
        <Spinner size="xs" />
      {:else}
        <Icon icon={GallerySend} />
      {/if}
    </Button>
    <Button
      disabled={$uploading}
      onclick={showPopover}
      class="join-item h-10 w-10 min-w-10 button button-neutral">
      <Tippy
        bind:controller={tippy}
        component={ComposeMenu}
        props={{url, h, onClick: hidePopover}}
        params={{trigger: "manual", interactive: true}}>
        <Icon icon={WidgetAdd} />
      </Tippy>
    </Button>
  </div>
  <div class="chat-editor grow overflow-hidden">
    <EditorContent {autofocus} {editor} />
  </div>
  {#if recording || $empty}
    <DictationButton bind:recording onTranscript={insertTranscript} />
  {:else}
    <Button
      data-tip="{window.navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}+enter to send"
      class="button button-primary button-circle flex justify-center items-center tip tip-left h-10 w-10 min-w-10"
      disabled={$uploading}
      onclick={submit}>
      <Icon icon={Plane} />
    </Button>
  {/if}
</form>
