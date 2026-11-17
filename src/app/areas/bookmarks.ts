import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {removeUndefined, sortBy, uniq, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {getIdFilters, getIdOrAddress, isReplaceable, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {BookmarkListWriter, BookmarkSetReader} from "@welshman/domain"
import {observeEventsById, withGetter} from "@welshman/store"
import {BookmarkLists, BookmarkSets, createSearch, publish} from "@welshman/app"
import type {Command} from "@welshman/app"
import {app, fromApp} from "@app/core/app"
import {deriveUserItem, syncUserList} from "@app/core/user"
import {deletes, network} from "@app/core/plugins"
import {registerSync} from "@app/core/sync"

const settle = async (pending: Promise<Command>) => {
  const publication = await pending.then(publish)

  return publication.getError()
}

// Folders

export type BookmarkFolder = {
  // The uncategorized folder is the kind 10003 list, which has no address.
  address?: string
  title: string
  bookmarks: string[][]
}

export const userBookmarkFolders = withGetter(
  derived(
    [
      deriveUserItem(BookmarkLists),
      fromApp($app =>
        $app.user
          ? $app.use(BookmarkSets).forAuthor($app.user.pubkey).$
          : readable<BookmarkSetReader[]>([]),
      ),
    ],
    ([$list, $sets]): BookmarkFolder[] => [
      {title: "Uncategorized", bookmarks: $list?.bookmarks() ?? []},
      ...sortBy(set => set.title()?.toLowerCase() || "", $sets).map(set => ({
        address: set.address(),
        title: set.title() || "Untitled folder",
        bookmarks: set.bookmarks(),
      })),
    ],
  ),
)

export const loadUserBookmarks = (pubkey: string) => {
  app.get().use(BookmarkLists).load(pubkey)
  app.get().use(BookmarkSets).loadForAuthor(pubkey)
}

// Bookmarks

// A bookmark carries a relay hint, which is the only route back to the event it names.
export const eventToBookmark = (event: TrustedEvent, url?: string) => {
  const hint = url || Array.from(app.get().repository.tracker.getRelays(event.id))[0]
  const tag = [isReplaceable(event) ? "a" : "e", getIdOrAddress(event)]

  return hint ? [...tag, hint] : tag
}

export const deriveIsBookmarked = (value: string): Readable<boolean> =>
  derived(userBookmarkFolders, $folders =>
    $folders.some(folder => folder.bookmarks.some(tag => tag[1] === value)),
  )

export const userBookmarkedEvents = derived(
  userBookmarkFolders,
  ($folders, set: (events: Map<string, TrustedEvent>) => void) => {
    const bookmarks = $folders.flatMap(folder => folder.bookmarks)
    const values = bookmarks.filter(tag => ["e", "a"].includes(tag[0])).map(tag => tag[1])

    if (values.length > 0) {
      const controller = new AbortController()
      const filters = getIdFilters(values)
      const relays = uniq(removeUndefined(bookmarks.map(tag => tag[2])))

      if (relays.length > 0) {
        network.get().load({
          relays,
          filters,
          signal: controller.signal,
        })
      }

      const unsubscribe = observeEventsById({
        filters,
        repository: app.get().repository,
        onEvents: $byId =>
          set(new Map(Array.from($byId.values(), event => [getIdOrAddress(event), event]))),
      })

      return () => {
        controller.abort()
        unsubscribe()
      }
    }

    set(new Map())
  },
  new Map<string, TrustedEvent>(),
)

// A bookmark is searched by what its card shows and by the text of the event behind it.
export const userBookmarkSearch = derived(
  [userBookmarkFolders, userBookmarkedEvents],
  ([$folders, $eventsByValue]) => {
    const getSearchText = (tag: string[]) => {
      const event = $eventsByValue.get(tag[1])

      return removeUndefined([
        ["t", "r"].includes(tag[0]) ? tag[1] : undefined,
        event && tagValue(tagSpec("title"), event.tags),
        event && tagValue(tagSpec("summary"), event.tags),
        event?.content,
      ]).join(" ")
    }

    return createSearch(
      uniqBy(
        tag => tag[1],
        $folders.flatMap(folder => folder.bookmarks),
      ),
      {
        getValue: (tag: string[]) => tag[1],
        fuseOptions: {
          // An event's text can be long, and a match anywhere in it counts.
          ignoreLocation: true,
          threshold: 0.3,
          keys: [{name: "search_text", getFn: getSearchText}],
        },
      },
    )
  },
)

// A folder is a bookmark set, or the kind 10003 list when it has no address of its own.
const updateFolder = (address: Maybe<string>, fn: (writer: BookmarkListWriter) => void) =>
  settle(
    address
      ? app.get().use(BookmarkSets).update(address, fn)
      : app.get().use(BookmarkLists).update(fn),
  )

export const addBookmark = (tag: string[], address?: string) =>
  updateFolder(address, writer => writer.bookmarkPublicly(tag))

export const createBookmarkFolder = (title: string) =>
  settle(app.get().use(BookmarkSets).create({title}))

export const renameBookmarkFolder = (address: string, title: string) =>
  settle(
    app
      .get()
      .use(BookmarkSets)
      .update(address, writer => writer.setTitle(title)),
  )

const foldersHolding = (value: string) =>
  userBookmarkFolders.get().filter(folder => folder.bookmarks.some(tag => tag[1] === value))

const removeEach = async (folders: BookmarkFolder[], value: string) => {
  const errors = await Promise.all(
    folders.map(folder => updateFolder(folder.address, writer => writer.removeBookmark(value))),
  )

  return errors.find(Boolean)
}

// Unbookmarking is a toggle, so it clears the value from wherever the user filed it.
export const removeBookmark = (value: string) => removeEach(foldersHolding(value), value)

export const moveBookmark = async (tag: string[], to?: string) => {
  const from = foldersHolding(tag[1]).filter(folder => folder.address !== to)
  const errors = await Promise.all([addBookmark(tag, to), removeEach(from, tag[1])])

  return errors.find(Boolean)
}

export const deleteBookmarkFolder = async (address: string) => {
  const set = app.get().use(BookmarkSets).get(address)

  if (set) {
    return settle(deletes.get().deleteEvent(set.event))
  }
}

export const registerBookmarks = () => {
  registerSync(() => syncUserList(loadUserBookmarks))
}
