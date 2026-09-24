<script lang="ts">
  import {randomId} from "@welshman/lib"
  import {preventDefault, stopPropagation} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {compressFileForUpload, uploadFileOrFallback} from "@app/uploads"

  interface Props {
    file?: File | undefined
    url?: string | undefined
  }

  let {file = $bindable(), url = $bindable()}: Props = $props()

  const id = randomId()

  // Compressed hard, so the base64 fallback fits in the profile event.
  const compressOptions = {maxWidth: 128, maxHeight: 128, quality: 0.6, mimeType: "image/jpeg"}

  const onDragEnter = () => {
    active = true
  }

  const onDragOver = () => {
    active = true
  }

  const onDragLeave = () => {
    active = false
  }

  const onDrop = async (e: any) => {
    active = false

    submit(e.dataTransfer.files[0])
  }

  const onChange = async (e: any) => {
    submit(e.target.files[0])
  }

  const submit = async (newFile: File) => {
    if (!newFile) {
      url = initialUrl
      return
    }

    loading = true

    try {
      file = await compressFileForUpload(newFile, compressOptions)
      url = (await uploadFileOrFallback(file)).url
    } finally {
      loading = false
    }
  }

  const onClear = () => {
    initialUrl = undefined
    file = undefined
    url = undefined
  }

  let active = $state(false)
  let loading = $state(false)
  let initialUrl = $state(url)
</script>

<form>
  <input
    {id}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onchange={onChange}
    class="hidden" />
  <label
    for={id}
    aria-label="Drag and drop files here."
    style="background-image: url({url}); border-color: {active ? 'var(--primary)' : 'var(--line)'};"
    class="bg-surface-more relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-solid bg-cover bg-center transition-all"
    class:transparent={!url}
    ondragenter={stopPropagation(preventDefault(onDragEnter))}
    ondragover={stopPropagation(preventDefault(onDragOver))}
    ondragleave={stopPropagation(preventDefault(onDragLeave))}
    ondrop={stopPropagation(preventDefault(onDrop))}>
    <button
      onclick={url ? stopPropagation(onClear) : undefined}
      class="absolute right-0 top-0 h-5 w-5 overflow-hidden rounded-full flex items-center justify-center"
      style="background: {url ? 'var(--error)' : 'var(--primary)'};">
      {#if url}
        <Icon icon={CloseCircle} class="scale-150 bg-surface-more!" />
      {:else}
        <Icon icon={AddCircle} class="scale-150 bg-surface-more!" />
      {/if}
    </button>
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
        <Spinner />
      </div>
    {:else if !url}
      <Icon icon={GallerySend} size={7} />
    {/if}
  </label>
</form>
