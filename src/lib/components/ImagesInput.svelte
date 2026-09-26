<script lang="ts">
  import cx from "classnames"
  import {equals, randomId} from "@welshman/lib"
  import {preventDefault, stopPropagation} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import DragList from "@lib/components/DragList.svelte"

  type Props = {
    value: (string | File)[]
    multiple?: boolean
  }

  type Entry = {id: string; value: string | File}

  let {value = $bindable(), multiple = true}: Props = $props()

  const id = randomId()

  const toEntry = (value: string | File) => ({id: randomId(), value})

  const getKey = (entry: Entry) => entry.id

  const getImageUrl = (item: string | File): string => {
    if (typeof item === "string") {
      return item
    }
    return URL.createObjectURL(item)
  }

  const setEntries = (newEntries: Entry[]) => {
    entries = newEntries
    value = newEntries.map(entry => entry.value)
  }

  const addFiles = (files: FileList | File[]) => {
    const newEntries = Array.from(files)
      .filter(file => file.type.startsWith("image/"))
      .map(toEntry)

    setEntries(multiple ? [...entries, ...newEntries] : newEntries.slice(0, 1))
  }

  const removeItem = (id: string) => setEntries(entries.filter(entry => entry.id !== id))

  const onFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files?.length) {
      addFiles(target.files)
      target.value = ""
    }
  }

  const onDrop = (e: Event) => {
    dropActive = false
    const dragEvent = e as DragEvent
    if (dragEvent.dataTransfer?.files?.length) {
      addFiles(dragEvent.dataTransfer.files)
    }
  }

  const onDragEnter = (e: Event) => {
    dropActive = true
  }

  const onDragOver = (e: Event) => {
    dropActive = true
  }

  const onDragLeave = (e: Event) => {
    dropActive = false
  }

  // Urls can repeat, so each image carries an id to key it by.
  let entries = $state.raw(value.map(toEntry))
  let dropActive = $state(false)

  $effect(() => {
    if (
      !equals(
        value,
        entries.map(entry => entry.value),
      )
    ) {
      entries = value.map(toEntry)
    }
  })
</script>

<div class="flex flex-col gap-2">
  <div class={cx("grid gap-3", multiple ? "grid-cols-3" : "grid-cols-1")} role="list">
    <DragList
      class="contents"
      itemClass={cx(
        "border-line bg-surface-more relative overflow-hidden rounded-2xl border border-solid",
        multiple ? "aspect-square cursor-move" : "aspect-video",
      )}
      itemRole="listitem"
      items={entries}
      {getKey}
      onReorder={setEntries}>
      {#snippet item(entry)}
        <img
          src={getImageUrl(entry.value)}
          alt="Upload preview"
          class="h-full w-full object-cover" />
        <Button
          aria-label="Remove image"
          class="button button-neutral button-xs button-circle bg-surface absolute right-1 top-1"
          onclick={() => removeItem(entry.id)}>
          <Icon icon={CloseCircle} size={4} />
        </Button>
      {/snippet}
    </DragList>
    {#if multiple || value.length === 0}
      <label
        for={id}
        class={cx(
          "border-line flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-3 text-sm",
          multiple ? "aspect-square" : "aspect-video",
        )}
        style:border-color={dropActive ? "var(--primary)" : undefined}
        aria-label={multiple
          ? "Drag and drop images here or click to select"
          : "Drag and drop an image here or click to select"}
        ondragenter={stopPropagation(preventDefault(onDragEnter))}
        ondragover={stopPropagation(preventDefault(onDragOver))}
        ondragleave={stopPropagation(preventDefault(onDragLeave))}
        ondrop={stopPropagation(preventDefault(onDrop))}>
        <div class="flex flex-col items-center gap-2 text-center">
          <Icon icon={GallerySend} size={8} />
          <p class="text-content-muted text-sm">
            Drag and drop {multiple ? "images" : "an image"} or click to select
          </p>
        </div>
      </label>
    {/if}
  </div>
  <input {id} type="file" accept="image/*" {multiple} onchange={onFileChange} class="hidden" />
</div>
