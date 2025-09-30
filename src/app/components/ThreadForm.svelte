<script lang="ts">
  import {isMobile, preventDefault} from "@lib/html.js"
  import Paperclip from "@assets/icons/paperclip-2.svg"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {makeEditor} from "@app/editor/index.js"
  import {writable} from "svelte/store"
  import type {Snippet} from "svelte"
  import {pushToast} from "@app/util/toast"
  import {canEnforceNip70} from "@app/core/commands"
  import {PROTECTED} from "@app/core/state"
  import {publishThunk} from "@welshman/app"
  import {makeEvent, THREAD} from "@welshman/util"
  import {randomId} from "@welshman/lib"

  export type Values = {
    d?: string,
    title?: string
    content?: string
    tags?: string[][]
  }

  type Props = {
    url: string
    initialValues?: Values
    header: Snippet
    footer: Snippet
  }

  const back = () => history.back()

  const {url, initialValues, header, footer}: Props = $props()

  const values = $state(initialValues || {})

  const shouldProtect = canEnforceNip70(url)

  const submit = async () => {
    if ($uploading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your thread.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content.trim()) {
      return pushToast({
        theme: "error",
        message: "Please provide a message for your thread.",
      })
    }

    const tags = [
      ...ed.storage.nostr.getEditorTags(),
      ["d", values.d || randomId()],
      ["title", title],
    ]

    if (await shouldProtect) {
      tags.push(PROTECTED)
    }

    const event = makeEvent(THREAD, {content, tags})

    pushToast({message: "Your thread has been saved!"})
    publishThunk({
      relays: [url],
      event,
    })

    back()
  }

  const uploading = writable(false)
  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const editor = makeEditor({url, submit, uploading, content: values.content, placeholder: "What's on your mind?"})

  let title: string = $state(values.title || "")
</script>

<form class="column gap-4" onsubmit={preventDefault(submit)}>
  {@render header()}
  <div class="col-8 relative">
    <Field>
      {#snippet label()}
        <p>Title*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            autofocus={!isMobile}
            bind:value={title}
            class="grow"
            type="text"
            placeholder="What is this thread about?" />
        </label>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        <p>Message*</p>
      {/snippet}
      {#snippet input()}
        <div class="note-editor flex-grow overflow-hidden">
          <EditorContent {editor} />
        </div>
      {/snippet}
    </Field>
    <Button
      data-tip="Add an image"
      class="tooltip tooltip-left absolute bottom-1 right-2"
      onclick={selectFiles}>
      {#if $uploading}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon icon={Paperclip} size={3} />
      {/if}
    </Button>
  </div>
  {@render footer()}
</form>
