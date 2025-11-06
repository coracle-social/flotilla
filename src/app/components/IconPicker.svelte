<script lang="ts">
  import {createSearch} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"

  const iconModules = import.meta.glob("@assets/icons/*.svg", {
    query: "?dataurl",
    eager: true,
  })

  const icons = Object.entries(iconModules)
    .map(([path, module]) => {
      const name = path.split("/").pop()?.replace(".svg", "") || ""
      return {
        name,
        url: (module as any).default,
        searchText: name.replace(/[-_]/g, " ").toLowerCase(),
      }
    })
    .filter(icon => icon.name && !icon.name.startsWith("icon-") && icon.name !== "index")
    .sort((a, b) => a.name.localeCompare(b.name))

  const iconSearch = createSearch(icons, {
    getValue: icon => icon.name,
    fuseOptions: {
      keys: ["name", "searchText"],
      threshold: 0.4,
    },
  })

  type Props = {
    onSelect: (iconUrl: string) => void
  }

  const {onSelect}: Props = $props()

  let searchTerm = $state("")

  const filteredIcons = $derived(searchTerm ? iconSearch.searchOptions(searchTerm) : icons)

  const handleSelect = (iconUrl: string) => {
    onSelect(iconUrl)
  }
</script>

<div class="w-96 rounded-box bg-base-100 p-4 shadow-2xl">
  <label class="input input-bordered flex w-full items-center gap-2">
    <Icon icon={Magnifier} />
    <input bind:value={searchTerm} class="grow" type="text" placeholder="Search icons..." />
  </label>
  <div class="mt-2 max-h-80 overflow-y-auto">
    <div class="grid grid-cols-8 gap-2 p-2">
      {#each filteredIcons as icon}
        <button
          class="flex aspect-square items-center justify-center rounded-box transition-colors hover:bg-primary hover:text-primary-content"
          onclick={() => handleSelect(icon.url)}
          title={icon.name}>
          <Icon icon={icon.url} class="h-6 w-6" />
        </button>
      {/each}
    </div>
  </div>
</div>
