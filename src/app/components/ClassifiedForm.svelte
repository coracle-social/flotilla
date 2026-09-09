<script lang="ts">
  import type {Snippet} from "svelte"
  import {removeUndefined, randomId, uniq} from "@welshman/lib"
  import {relay} from "@welshman/util"
  import {publish} from "@welshman/app"
  import {Classified} from "@welshman/domain"
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
  import {command, relays, writer} from "@app/core"
  import {pushToast} from "@app/toast"
  import {publishRoomQuote} from "@app/rooms"
  import {makeEditor} from "@app/editor"
  import {DraftKey} from "@app/drafts"
  import {compressFileForUpload, uploadFile} from "@app/uploads"

  type Values = {
    d: string
    title: string
    content: string | object
    price: number
    currency: string
    images: (string | File)[]
    status: string
    topics: string[]
  }

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
    header: Snippet
    initialValues?: Values
  }

  let {url, h, shareToChat = false, header, initialValues}: Props = $props()

  const draftKey = new DraftKey<Values>(`classified:${url}:${h ?? ""}`)

  if (!initialValues) {
    initialValues = draftKey.get()
  }

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

      const imageUrls: string[] = []

      for (const image of images) {
        if (typeof image === "string") {
          imageUrls.push(image)
        } else {
          const {result, error} = await uploadFile(await compressFileForUpload(image), {url})

          if (error) {
            return pushToast({
              theme: "error",
              message: `Failed to upload file ${image.name}`,
            })
          }

          if (result) {
            imageUrls.push(result.url)
          }
        }
      }

      const protect = await $relays.hasNip(url, 70)

      const eventWriter = writer(Classified)
        .setIdentifier(d)
        .setContent(content)
        .setTitle(title)
        .setSummary(content)
        .setPrice(price, currency)
        .setStatus(status)
        .setTopics(topics)
        .setImages(imageUrls)
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())

      if (h) {
        eventWriter.setRoom(url, h)
      } else {
        eventWriter.forceRoutes(relay(url))
      }

      const classifiedThunk = await command(eventWriter).then(publish)
      const error = await classifiedThunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()

      if (shareToChat) {
        publishRoomQuote({url, h, parent: classifiedThunk.event, protect})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  const d = $state(initialValues?.d ?? randomId())
  let title = $state(initialValues?.title ?? "")
  let status = $state(initialValues?.status ?? "active")
  let price = $state(initialValues?.price ?? 0)
  let currency = $state(initialValues?.currency ?? "SAT")
  let images = $state(initialValues?.images ?? [])
  let topics = $state(uniq(removeUndefined(initialValues?.topics?.map(normalizeTopic) ?? [])))
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({url, submit, onChange, content})

  $effect(() => {
    draftKey.set({d, title, status, price, currency, images, topics, content})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    {@render header?.()}
    <div class="flex flex-col gap-8 relative">
      <Field>
        {#snippet label()}
          <p>Title*</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
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
          <div class="note-editor grow overflow-hidden">
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
            <label class="input flex w-full items-center gap-2">
              <input bind:value={price} class="grow w-32" type="number" />
            </label>
            <CurrencyInput bind:value={currency} />
          </div>
        {/snippet}
      </Field>
      {#if initialValues}
        <Field>
          {#snippet label()}
            <p>Status*</p>
          {/snippet}
          {#snippet input()}
            <select class="select input w-full" bind:value={status}>
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
    <Button onclick={back} disabled={loading} class="button button-link">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" disabled={loading} class="button button-primary">
      <Spinner {loading}>Save Listing</Spinner>
    </Button>
  </ModalFooter>
</Modal>
