<script lang="ts">
  import type {Snippet} from "svelte"
  import {removeUndefined, randomId, uniq} from "@welshman/lib"
  import {makeEvent, CLASSIFIED} from "@welshman/util"
  import {publishThunk} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import {normalizeTopic} from "@lib/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ImagesInput from "@lib/components/ImagesInput.svelte"
  import CurrencyInput from "@app/components/CurrencyInput.svelte"
  import TopicMultiSelect from "@app/components/TopicMultiSelect.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {pushToast} from "@app/util/toast"
  import {PROTECTED} from "@app/core/state"
  import {makeEditor} from "@app/editor"
  import {canEnforceNip70, uploadFile} from "@app/core/commands"

  type Props = {
    url: string
    h?: string
    header: Snippet
    initialValues?: {
      d?: string
      title?: string
      content?: string
      price?: number
      currency?: string
      images?: string[]
      status?: string
      topics?: string[]
    }
  }

  const {url, h, header, initialValues}: Props = $props()

  const shouldProtect = canEnforceNip70(url)

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      if (!title) {
        return pushToast({
          theme: "error",
          message: "Please provide a title for your listing.",
        })
      }

      const ed = await editor
      const content = ed.getText({blockSeparator: "\n"}).trim()

      if (!content.trim()) {
        return pushToast({
          theme: "error",
          message: "Please provide a description for your listing.",
        })
      }

      const tags = [
        ["d", initialValues?.d || randomId()],
        ["title", title],
        ["summary", content],
        ["price", String(price), currency],
        ["status", status],
        ...ed.storage.nostr.getEditorTags(),
      ]

      for (const topic of topics) {
        tags.push(["t", topic])
      }

      if (await shouldProtect) {
        tags.push(PROTECTED)
      }

      if (h) {
        tags.push(["h", h])
      }

      for (const image of images) {
        if (typeof image === "string") {
          tags.push(["image", image])
        } else {
          const {result, error} = await uploadFile(image, {url})

          if (error) {
            return pushToast({
              theme: "error",
              message: `Failed to upload file ${image.name}`,
            })
          }

          if (result) {
            tags.push(["image", result.url])
          }
        }
      }

      publishThunk({
        relays: [url],
        event: makeEvent(CLASSIFIED, {content, tags}),
      })

      history.back()
    } finally {
      loading = false
    }
  }

  const content = initialValues?.content || ""
  const editor = makeEditor({url, submit, content})

  let loading = $state(false)
  let title = $state(initialValues?.title || "")
  let status = $state(initialValues?.status || "active")
  let price = $state(Number(initialValues?.price || 0))
  let currency = $state(initialValues?.currency || "SAT")
  let images = $state<(string | File)[]>(initialValues?.images || [])
  let topics = $state(uniq(removeUndefined((initialValues?.topics || []).map(normalizeTopic))))
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    {@render header?.()}
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
              placeholder="What is this listing for?" />
          </label>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Description*</p>
        {/snippet}
        {#snippet input()}
          <div class="note-editor flex-grow overflow-hidden">
            <EditorContent {editor} />
          </div>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Topics</p>
        {/snippet}
        {#snippet input()}
          <TopicMultiSelect bind:value={topics} />
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Price*</p>
        {/snippet}
        {#snippet input()}
          <div class="join grid grid-cols-2">
            <label class="join-item input input-bordered flex w-full items-center gap-2">
              <input bind:value={price} class="grow w-32" type="number" />
            </label>
            <CurrencyInput class="join-item" bind:value={currency} />
          </div>
        {/snippet}
      </Field>
      {#if initialValues}
        <Field>
          {#snippet label()}
            <p>Status*</p>
          {/snippet}
          {#snippet input()}
            <select class="select select-bordered w-full" bind:value={status}>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
            </select>
          {/snippet}
        </Field>
      {/if}
      <Field>
        {#snippet label()}
          <p>Images (optional)</p>
        {/snippet}
        {#snippet input()}
          <ImagesInput bind:value={images} />
        {/snippet}
      </Field>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Save Listing</Spinner>
    </Button>
  </ModalFooter>
</Modal>
