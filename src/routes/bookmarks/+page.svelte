<script lang="ts">
  import {fly} from "@lib/transition"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import BookmarkFolderEdit from "@app/components/BookmarkFolderEdit.svelte"
  import BookmarkFolderSection from "@app/components/BookmarkFolderSection.svelte"
  import {matchesQuery, userBookmarkedEvents, userBookmarkFolders} from "@app/bookmarks"
  import {pushModal} from "@app/modal"

  const createFolder = () => pushModal(BookmarkFolderEdit)

  let query = $state("")

  const searching = $derived(Boolean(query.trim()))

  const isEmpty = $derived(
    $userBookmarkFolders.length === 1 && $userBookmarkFolders[0].bookmarks.length === 0,
  )

  // An empty folder is worth showing until a search is on, when it is only noise.
  const folders = $derived(
    $userBookmarkFolders
      .map(folder => ({
        ...folder,
        bookmarks: folder.bookmarks.filter(tag =>
          matchesQuery(tag, $userBookmarkedEvents.get(tag[1]), query),
        ),
      }))
      .filter(folder => folder.bookmarks.length > 0 || !searching),
  )
</script>

<Page>
  <PageBar>
    <div class="flex items-center justify-between gap-4" in:fly>
      <div class="truncate min-w-0 flex items-center gap-2 whitespace-nowrap">
        <Icon icon={Bookmark} size={6} />
        <strong>Bookmarks</strong>
      </div>
      <Button class="button button-primary button-sm" onclick={createFolder}>
        <Icon icon={AddCircle} size={4} />
        New folder
      </Button>
    </div>
  </PageBar>
  <PageContent>
    {#if isEmpty}
      <p class="py-24 text-center text-content-muted">
        Nothing bookmarked yet. Bookmark a message, note or thread from its menu and it shows up
        here.
      </p>
    {:else}
      <label class="input flex items-center gap-2">
        <Icon icon={Magnifier} class="shrink-0 text-content-muted" />
        <input bind:value={query} class="grow" type="text" placeholder="Search bookmarks..." />
      </label>
      {#each folders as folder (folder.identifier || "")}
        <BookmarkFolderSection {folder} eventsByValue={$userBookmarkedEvents} />
      {/each}
      {#if folders.length === 0}
        <p class="py-24 text-center text-content-muted">No bookmarks match your search.</p>
      {/if}
    {/if}
  </PageContent>
</Page>
