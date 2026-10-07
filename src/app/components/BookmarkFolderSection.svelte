<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Folder from "@assets/icons/folder.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import BookmarkFolderMenu from "@app/components/BookmarkFolderMenu.svelte"
  import BookmarkItem from "@app/components/BookmarkItem.svelte"
  import type {BookmarkFolder} from "@app/bookmarks"

  type Props = {
    folder: BookmarkFolder
    eventsByValue: Map<string, TrustedEvent>
  }

  const {folder, eventsByValue}: Props = $props()
</script>

<section
  role="group"
  aria-label={folder.title}
  class="@container flex flex-col gap-2 rounded-3xl border border-line bg-surface-less p-4">
  <div class="flex h-8 items-center justify-between gap-2">
    <strong class="truncate min-w-0 flex items-center gap-2">
      <Icon size={4} icon={Folder} class="shrink-0" />
      {folder.title}
    </strong>
    <div class="flex shrink-0 items-center gap-2">
      <span class="text-sm text-content-muted">{folder.bookmarks.length}</span>
      {#if folder.identifier}
        <MenuButton
          component={BookmarkFolderMenu}
          componentProps={{folder}}
          aria-label="Folder actions" />
      {/if}
    </div>
  </div>
  {#if folder.bookmarks.length > 0}
    <div class="grid gap-2 @xl:grid-cols-2 @5xl:grid-cols-3">
      {#each folder.bookmarks as tag (tag[1])}
        <BookmarkItem {folder} {tag} event={eventsByValue.get(tag[1])} />
      {/each}
    </div>
  {:else}
    <p class="py-10 text-center text-sm text-content-muted">Nothing in this folder yet.</p>
  {/if}
</section>
