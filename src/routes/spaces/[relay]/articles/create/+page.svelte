<script lang="ts">
  import {onMount} from "svelte"
  import {writable} from "svelte/store"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import {now, randomId} from "@welshman/lib"
  import {getAddress, relay} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import {publish} from "@welshman/app"
  import {isMobile} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import TopicMultiSelect from "@app/components/TopicMultiSelect.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {command, relays, writer} from "@app/core"
  import {DraftKey} from "@app/drafts"
  import {makeEditor} from "@app/editor"
  import {decodeRelay} from "@app/relays"
  import {publishRoomQuote} from "@app/rooms"
  import {makeArticlePath} from "@app/routes"
  import {compressFileForUpload, uploadFile} from "@app/uploads"
  import {pushToast} from "@app/toast"

  type Values = {
    d?: string
    content?: string | object
    title?: string
    summary?: string
    image?: string
    topics?: string[]
  }

  const url = decodeRelay($page.params.relay!)

  const h = $page.url.searchParams.get("h") ?? undefined
  const shareToChat = $page.url.searchParams.has("shareToChat")

  const draftKey = new DraftKey<Values>(`article:${url}:${h ?? ""}`)
  const initialValues = draftKey.get()
  const shouldProtect = $relays.hasNip(url, 70)
  const coverInputId = randomId()

  const uploading = writable(false)

  const back = () => goto(makeArticlePath(url))

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const clearCover = () => {
    image = ""
  }

  const onCoverChange = async (event: Event & {currentTarget: HTMLInputElement}) => {
    const input = event.currentTarget
    const file = input.files?.[0]

    // Clear the input so picking the same file again after removing the cover still fires
    input.value = ""

    if (file) {
      uploadingCover = true

      try {
        const {result, error} = await uploadFile(await compressFileForUpload(file), {url})

        if (result?.url) {
          image = result.url
        } else {
          pushToast({theme: "error", message: error ?? "Failed to upload your cover image."})
        }
      } catch (e) {
        // compressFileForUpload rejects outside uploadFile's own error handling
        console.error("Error caught when uploading cover image:", e)
        pushToast({theme: "error", message: "Failed to upload your cover image."})
      } finally {
        uploadingCover = false
      }
    }
  }

  const submit = async () => {
    if ($uploading || uploadingCover || loading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your article.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content) {
      return pushToast({
        theme: "error",
        message: "Please write something for your article.",
      })
    }

    loading = true

    try {
      const protect = await shouldProtect
      const eventWriter = writer(Article)
        .setIdentifier(d)
        .setContent(content)
        .setTitle(title)
        .setTopics(topics)
        .setPublishedAt(now())
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())
        .forceRoutes(relay(url))

      if (summary) {
        eventWriter.setSummary(summary)
      }

      if (image) {
        eventWriter.setImage(image)
      }

      if (h) {
        eventWriter.setRoom(url, h)
      }

      const thunk = await command(eventWriter).then(publish)
      const error = await thunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      goto(makeArticlePath(url, getAddress(thunk.event)))

      if (shareToChat) {
        publishRoomQuote({url, h, parent: thunk.event, protect})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let uploadingCover = $state(false)
  let titleInput = $state<HTMLInputElement>()

  // The autofocus attribute is ignored while the button that navigated here still holds focus
  onMount(() => {
    if (!isMobile) {
      titleInput?.focus()
    }
  })

  const d = $state(initialValues?.d ?? randomId())
  let title = $state(initialValues?.title ?? "")
  let summary = $state(initialValues?.summary ?? "")
  let image = $state(initialValues?.image ?? "")
  let topics = $state(initialValues?.topics ?? [])
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    url,
    submit,
    uploading,
    onChange,
    placeholder: "Write your article...",
    content,
  })

  $effect(() => {
    draftKey.update({d, title, summary, image, topics, content})
  })
</script>

<SpaceBar {back}>
  {#snippet leading()}
    <Icon icon={DocumentText} />
  {/snippet}
  {#snippet title()}
    <strong>Write an Article</strong>
  {/snippet}
  {#snippet action()}
    <Button
      class="button button-primary button-sm"
      onclick={submit}
      disabled={$uploading || uploadingCover || loading}>
      <Spinner {loading}>Publish</Spinner>
    </Button>
  {/snippet}
</SpaceBar>

<!-- column flex: justify-center would put the top of a tall page out of scroll reach -->
<PageContent class="items-center">
  <div class="flex w-full max-w-3xl flex-col gap-6">
    <input
      id={coverInputId}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onchange={onCoverChange}
      class="hidden" />
    {#if image}
      <div class="relative">
        <img src={image} alt="Article cover" class="h-56 w-full rounded-2xl object-cover" />
        <Button
          data-tip="Remove cover image"
          aria-label="Remove cover image"
          class="tip tip-left button button-neutral button-sm button-circle absolute right-2 top-2"
          onclick={clearCover}>
          <Icon icon={CloseCircle} />
        </Button>
      </div>
    {:else}
      <label
        for={coverInputId}
        class="flex h-28 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-content-muted transition-colors hover:text-content">
        {#if uploadingCover}
          <Spinner loading>Uploading cover image...</Spinner>
        {:else}
          <Icon icon={GallerySend} />
          Add a cover image
        {/if}
      </label>
    {/if}
    <div class="flex flex-col gap-2">
      <input
        bind:this={titleInput}
        bind:value={title}
        class="bg-transparent text-3xl font-bold outline-none placeholder:text-content-muted"
        type="text"
        placeholder="Title" />
      <input
        bind:value={summary}
        class="placeholder:text-content-muted bg-transparent text-lg outline-none"
        type="text"
        placeholder="Add a one line teaser for the article list" />
    </div>
    <div class="relative">
      <div class="article-editor note-editor">
        <EditorContent {editor} />
      </div>
      <Button
        data-tip="Add an image"
        class="tip tip-left absolute bottom-1 right-2"
        onclick={selectFiles}
        disabled={loading}>
        {#if $uploading}
          <Spinner size="xs" />
        {:else}
          <Icon icon={Paperclip} size={3} />
        {/if}
      </Button>
    </div>
    <Field>
      {#snippet label()}
        <p>Topics</p>
      {/snippet}
      {#snippet input()}
        <TopicMultiSelect bind:value={topics} />
      {/snippet}
    </Field>
  </div>
</PageContent>
