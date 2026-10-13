<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"
  import {removeUndefined, randomId, uniq, toggle} from "@welshman/lib"
  import {Classified} from "@welshman/domain"
  import {isMobile, preventDefault} from "@lib/html"
  import {normalizeTopic} from "@lib/util"
  import {SUGGESTED_TOPICS} from "@app/features/classifieds"
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
  import EditorContent from "@app/features/editor/EditorContent.svelte"
  import {writer} from "@app/core/domain"
  import {pushToast} from "@app/ui/toast"
  import {publishToSpace} from "@app/features/rooms"
  import {makeEditor} from "@app/features/editor"
  import {DraftKey} from "@app/features/drafts"
  import {compressFileForUpload, uploadFile} from "@app/core/uploads"

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

  // An edit starts from the event, and saving it as a draft would carry it into the next create.
  const editing = Boolean(initialValues)
  const draftKey = editing ? undefined : new DraftKey<Values>(`classified:${url}:${h ?? ""}`)

  if (draftKey) {
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

      const eventWriter = writer(Classified)
        .setIdentifier(d)
        .setContent(content)
        .setTitle(title)
        .setSummary(content)
        .setPrice(price, currency)
        .setStatus(status)
        .setTopics(topics)
        .setImages(imageUrls)
        .addTags(...ed.storage.nostr.getEditorTags())

      const {error} = await publishToSpace(eventWriter, {url, h, shareToChat})

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey?.clear()
      history.back()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to publish your listing."})
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

  const toggleTopic = (topic: string) => () => {
    topics = toggle(topic, topics)
  }

  const editor = makeEditor({url, submit, onChange, content})

  $effect(() => {
    draftKey?.set({d, title, status, price, currency, images, topics, content})
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
          <p>Category</p>
        {/snippet}
        {#snippet input()}
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap gap-2">
              {#each SUGGESTED_TOPICS as topic (topic)}
                <button
                  type="button"
                  class={cx(
                    "button button-xs rounded-full",
                    topics.includes(topic) ? "button-primary" : "button-neutral",
                  )}
                  onclick={toggleTopic(topic)}>
                  #{topic}
                </button>
              {/each}
            </div>
            <TopicMultiSelect bind:value={topics} />
          </div>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Price*</p>
        {/snippet}
        {#snippet input()}
          <div class="grid grid-cols-2 gap-2">
            <label class="input flex w-full items-center gap-2">
              <input bind:value={price} class="grow w-32" type="number" />
            </label>
            <CurrencyInput bind:value={currency} />
          </div>
        {/snippet}
      </Field>
      {#if editing}
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
