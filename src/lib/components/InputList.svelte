<script lang="ts">
  import type {Snippet} from "svelte"
  import {append, equals, randomId} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import DragList from "@lib/components/DragList.svelte"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import HamburgerMenu from "@assets/icons/hamburger-menu.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    value: string[]
    addLabel?: Snippet
    placeholder?: string
    allowAdd?: boolean
  }

  type Entry = {id: string; value: string}

  let {
    value = $bindable(),
    addLabel,
    placeholder = "Enter text...",
    allowAdd = true,
  }: Props = $props()

  const toEntry = (value: string) => ({id: randomId(), value})

  const getKey = (entry: Entry) => entry.id

  const setEntries = (newEntries: Entry[]) => {
    entries = newEntries
    value = newEntries.map(entry => entry.value)
  }

  const addItem = () => setEntries(append(toEntry(""), entries))

  const removeItem = (id: string) => setEntries(entries.filter(entry => entry.id !== id))

  const updateItem = (id: string, text: string) =>
    setEntries(entries.map(entry => (entry.id === id ? {id, value: text} : entry)))

  // Strings can be empty or repeated, so each one carries an id to key it by.
  let entries = $state.raw(value.map(toEntry))

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

<div class="flex flex-col gap-2" role="list">
  <DragList
    class="contents"
    itemClass="flex items-center gap-2"
    itemRole="listitem"
    items={entries}
    {getKey}
    onReorder={setEntries}>
    {#snippet item(entry)}
      <Button onclick={() => removeItem(entry.id)}>
        <Icon icon={TrashBin2} />
      </Button>
      <input
        type="text"
        class="input w-full"
        value={entry.value}
        {placeholder}
        oninput={e => updateItem(entry.id, e.currentTarget.value)} />
      <div class="cursor-move" role="button" aria-label="Drag handle">
        <Icon icon={HamburgerMenu} />
      </div>
    {/snippet}
  </DragList>
  {#if allowAdd}
    <Button class="button button-link w-fit px-0" onclick={addItem}>
      <Icon icon={AddCircle} size={5} />
      {#if addLabel}
        {@render addLabel?.()}
      {:else}
        Add Item
      {/if}
    </Button>
  {/if}
</div>
