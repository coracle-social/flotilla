<script lang="ts">
  import {writable} from "svelte/store"
  import {makeEvent, ZAP_GOAL} from "@welshman/util"
  import {publishThunk} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Button from "@lib/components/Button.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {pushToast} from "@app/util/toast"
  import {PROTECTED} from "@app/core/state"
  import {makeEditor} from "@app/editor"
  import {canEnforceNip70} from "@app/core/commands"
  import type {Snippet} from "svelte"
  import {randomId} from "@welshman/lib"

  export type Values = {
    d?: string,
  }

  type Props = {
    url: string,
    initialValues?: Values,
    header: Snippet,
    footer: Snippet,
  }

  const {url, initialValues, header, footer}: Props = $props()

  const values = $state(initialValues || {})

  const shouldProtect = canEnforceNip70(url)

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading) return

    if (!content) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your funding goal.",
      })
    }

    const ed = await editor
    const summary = ed.getText({blockSeparator: "\n"}).trim()

    if (!summary.trim()) {
      return pushToast({
        theme: "error",
        message: "Please provide details about your funding goal.",
      })
    }

    const tags = [
      ...ed.storage.nostr.getEditorTags(),
      ["d", values.d || randomId()],
      ["summary", summary],
      ["amount", String(amount)],
      ["relays", url],
    ]

    if (await shouldProtect) {
      tags.push(PROTECTED)
    }

    const event = makeEvent(ZAP_GOAL, {content, tags})

    publishThunk({
      relays: [url],
      event,
    })

    back()
  }

  const editor = makeEditor({url, submit, uploading, placeholder: "What's on your mind?"})

  let content = $state("")
  let amount = $state(1000)
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
            bind:value={content}
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
    <div class="flex flex-col gap-1">
      <FieldInline>
        {#snippet label()}
          Goal Amount (sats)*
        {/snippet}
        {#snippet input()}
          <div class="flex flex-grow justify-end">
            <label class="input input-bordered flex items-center gap-2">
              <Icon icon={Bolt} />
              <input bind:value={amount} type="number" class="w-28" />
              <p class="opacity-50">sats</p>
            </label>
          </div>
        {/snippet}
      </FieldInline>
      <input
        class="range range-primary -mt-2"
        type="range"
        min="1000"
        max="100000"
        step="1000"
        bind:value={amount} />
    </div>
  </div>
  {@render footer()}
</form>
