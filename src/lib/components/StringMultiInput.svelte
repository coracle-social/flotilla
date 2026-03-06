<script lang="ts">
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import {remove, uniq} from "@welshman/lib"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  interface Props {
    value: string[]
    term?: Writable<string>
    placeholder?: string
  }

  let {value = $bindable(), term = writable(""), placeholder = ""}: Props = $props()

  const normalizeItem = (text: string) => text.trim()

  const addItems = (text: string) => {
    const items = text.split(/[\n,]/).map(normalizeItem).filter(Boolean)

    if (items.length > 0) {
      value = uniq([...value, ...items])
    }

    term.set("")
  }

  const removeItem = (item: string) => {
    value = remove(item, value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && $term) {
      e.preventDefault()
      addItems($term)
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text")

    if (text) {
      e.preventDefault()
      addItems(text)
    }
  }

  const onBlur = () => {
    if ($term.trim()) {
      addItems($term)
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div>
    {#each value as item (item)}
      <div class="flex-inline badge badge-neutral mr-1 gap-1">
        <Button class="flex items-center" onclick={() => removeItem(item)}>
          <Icon icon={CloseCircle} size={4} class="-ml-1 mt-px" />
        </Button>
        <span>{item}</span>
      </div>
    {/each}
  </div>
  <label class="input input-bordered flex w-full items-center gap-2">
    <input
      bind:value={$term}
      class="grow"
      type="text"
      {placeholder}
      onkeydown={onKeyDown}
      onpaste={onPaste}
      onblur={onBlur} />
  </label>
</div>
