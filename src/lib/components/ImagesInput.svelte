<script lang="ts">
  import cx from "classnames"
  import type {Maybe} from "@welshman/lib"
  import {randomId} from "@welshman/lib"
  import {removeAt, insertAt} from "@welshman/lib"
  import {preventDefault, stopPropagation} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  interface Props {
    value: (string | File)[]
    multiple?: boolean
  }

  let {value = $bindable(), multiple = true}: Props = $props()

  const id = randomId()

  const getImageUrl = (item: string | File): string => {
    if (typeof item === "string") {
      return item
    }
    return URL.createObjectURL(item)
  }

  const addFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith("image/"))

    value = multiple ? [...value, ...newFiles] : newFiles.slice(0, 1)
  }

  const removeItem = (index: number) => {
    value = removeAt(index, value)
  }

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

  let draggedIndex: Maybe<number> = $state()
  let dropActive = $state(false)

  const handleDragStart = (e: DragEvent, index: number) => {
    draggedIndex = index

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()

    if (draggedIndex !== undefined && draggedIndex !== index) {
      value = insertAt(index, value[draggedIndex], removeAt(draggedIndex, value))
      draggedIndex = index
    }
  }

  const handleDragEnd = () => {
    draggedIndex = undefined
  }
</script>

<div class="flex flex-col gap-2">
  <div class={cx("grid gap-3", multiple ? "grid-cols-3" : "grid-cols-1")} role="list">
    {#each value as item, index (index)}
      <div
        class={cx(
          "border-line bg-surface-more relative overflow-hidden rounded-2xl border border-solid",
          multiple ? "aspect-square cursor-move" : "aspect-video",
        )}
        style:border-color={draggedIndex === index ? "var(--primary)" : undefined}
        draggable={multiple}
        role="listitem"
        aria-label={multiple ? "Draggable image" : "Image"}
        ondragstart={e => handleDragStart(e, index)}
        ondragover={e => handleDragOver(e, index)}
        ondragend={handleDragEnd}>
        <img src={getImageUrl(item)} alt="Upload preview" class="h-full w-full object-cover" />
        <Button
          aria-label="Remove image"
          class="button button-neutral button-xs button-circle bg-surface absolute right-1 top-1"
          onclick={() => removeItem(index)}>
          <Icon icon={CloseCircle} size={4} />
        </Button>
      </div>
    {/each}
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
