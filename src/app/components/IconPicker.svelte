<script lang="ts">
  import {createSearch} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import type {IconOption} from "@app/icons"

  type Props = {
    onSelect: (iconUrl: string) => void
  }

  const {onSelect}: Props = $props()

  let icons: IconOption[] = $state([])
  let searchTerm = $state("")

  const loading = import("@app/icons").then(module => {
    icons = module.icons
  })

  const iconSearch = $derived(
    createSearch(icons, {
      getValue: (icon: IconOption) => icon.name,
      fuseOptions: {
        keys: ["name", "searchText"],
        threshold: 0.4,
      },
    }),
  )

  const filteredIcons = $derived(searchTerm ? iconSearch.searchOptions(searchTerm) : icons)
</script>

<label class="input flex w-full items-center gap-2">
  <Icon icon={Magnifier} />
  <input bind:value={searchTerm} class="grow" type="text" placeholder="Search icons..." />
</label>
<div class="mt-2 max-h-80 overflow-y-auto">
  {#await loading}
    <Spinner class="p-2">Loading icons…</Spinner>
  {:then}
    <div class="grid grid-cols-8 gap-2 p-2">
      {#each filteredIcons as icon (icon.name)}
        <button
          type="button"
          title={icon.name}
          class="flex aspect-square items-center justify-center rounded-2xl transition-colors hover:bg-primary hover:text-primary-content"
          onclick={() => onSelect(icon.url)}>
          <Icon icon={icon.url} class="h-6 w-6" />
        </button>
      {/each}
    </div>
  {/await}
</div>
