import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {removeUndefined, sortBy, spec, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  Address,
  BOOKMARKS,
  NAMED_BOOKMARKS,
  getIdFilters,
  getIdOrAddress,
  isReplaceable,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {BookmarkList, EventQuery, KindFactory, ListReader, ListWriter} from "@welshman/domain"
import type {BookmarkListReader, BookmarkListWriter} from "@welshman/domain"
import {withGetter} from "@welshman/store"
import {DerivedPlugin, Domain, Network, User, publish} from "@welshman/app"
import type {Command, IApp} from "@welshman/app"
import {
  app,
  command,
  deletes,
  deriveUserItem,
  events,
  fromApp,
  network,
  user,
  writer,
} from "@app/core"

// NIP-51's four item tags: a note, an addressable event, a topic and a url.
const isBookmark = (tag: string[]) => ["e", "a", "t", "r"].includes(tag[0])

const settle = async (pending: Promise<Command>) => {
  const publication = await pending.then(publish)

  return (await publication.settled()).getError()
}

// Kind 30003, which welshman has no factory for. A named set is one of the user's folders.
export class BookmarkSetReader extends ListReader {
  title() {
    return tagValue(tagSpec("title"), this.event.tags)
  }
}

export class BookmarkSetWriter extends ListWriter<BookmarkSetReader> {
  setTitle(title: string) {
    return this.dropPublic(spec(["title"])).addPublic(["title", title])
  }
}

export class BookmarkSetQuery extends EventQuery {
  protected renderRoutes() {
    return this.authorRoutes()
  }
}

export const BookmarkSet = new KindFactory({
  kind: NAMED_BOOKMARKS,
  reader: BookmarkSetReader,
  writer: BookmarkSetWriter,
  query: BookmarkSetQuery,
})

export class BookmarkLists extends DerivedPlugin<BookmarkListReader> {
  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [BOOKMARKS]}],
      eventToItem: app.use(Domain).reader(BookmarkList),
      getKey: list => list.author(),
    })
  }

  fetch(pubkey: string, hints: string[] = []) {
    return this.app.use(Network).loadUsingOutbox(pubkey, {kinds: [BOOKMARKS]}, hints)
  }

  update = (fn: (eventWriter: BookmarkListWriter) => void) => {
    const {pubkey} = User.require(this.app)
    const eventWriter = this.app.use(Domain).writer(BookmarkList, this.get(pubkey))

    fn(eventWriter)

    return this.app.use(Domain).command(eventWriter)
  }
}

export class BookmarkSets extends DerivedPlugin<BookmarkSetReader> {
  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [NAMED_BOOKMARKS]}],
      eventToItem: app.use(Domain).reader(BookmarkSet),
      getKey: set => set.address(),
    })
  }

  fetch(address: string) {
    const {pubkey, identifier} = Address.from(address)

    return this.app
      .use(Network)
      .loadUsingOutbox(pubkey, {kinds: [NAMED_BOOKMARKS], "#d": [identifier]})
  }

  loadAll(pubkey: string) {
    return this.app.use(Network).loadAllUsingOutbox(pubkey, {kinds: [NAMED_BOOKMARKS]})
  }

  update = (identifier: string, fn: (eventWriter: BookmarkSetWriter) => void) => {
    const {pubkey} = User.require(this.app)
    const address = new Address(NAMED_BOOKMARKS, pubkey, identifier).toString()
    const eventWriter = this.app.use(Domain).writer(BookmarkSet, this.get(address))

    eventWriter.setIdentifier(identifier)
    fn(eventWriter)

    return this.app.use(Domain).command(eventWriter)
  }
}

// Folders

export type BookmarkFolder = {
  // The uncategorized folder is the kind 10003 list, which carries no identifier.
  identifier?: string
  title: string
  bookmarks: string[][]
}

export const userBookmarkFolders = withGetter(
  derived(
    [app, deriveUserItem(BookmarkLists), fromApp($app => $app.use(BookmarkSets).all.$)],
    ([$app, $list, $sets]): BookmarkFolder[] => [
      {title: "Uncategorized", bookmarks: ($list?.tags() || []).filter(isBookmark)},
      ...sortBy(
        set => set.title()?.toLowerCase() || "",
        $sets.filter(set => set.author() === $app.user?.pubkey),
      ).map(set => ({
        identifier: set.identifier(),
        title: set.title() || "Untitled folder",
        bookmarks: set.tags().filter(isBookmark),
      })),
    ],
  ),
)

export const loadUserBookmarks = (pubkey: string) => {
  app.get().use(BookmarkLists).load(pubkey)
  app.get().use(BookmarkSets).loadAll(pubkey)
}

// Bookmarks

// A bookmark carries a relay hint, which is the only route back to the event it names.
export const eventToBookmark = (event: TrustedEvent, url?: string) => {
  const hint = url || Array.from(app.get().tracker.getRelays(event.id))[0]
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
        network.get().loadLenient({relays, filters, signal: controller.signal})
      }

      const unsubscribe = events
        .get()
        .all(filters)
        .$.subscribe($events => set(new Map($events.map(event => [getIdOrAddress(event), event]))))

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
export const matchesQuery = (tag: string[], event: Maybe<TrustedEvent>, query: string) => {
  const q = query.trim().toLowerCase()

  if (!q) {
    return true
  }

  const haystack = removeUndefined([
    ["t", "r"].includes(tag[0]) ? tag[1] : undefined,
    event && tagValue(tagSpec("title"), event.tags),
    event && tagValue(tagSpec("summary"), event.tags),
    event?.content,
  ])
    .join(" ")
    .toLowerCase()

  return haystack.includes(q)
}

// A folder is a named set, or the kind 10003 list when it has no identifier of its own.
const updateFolder = (identifier: Maybe<string>, fn: (eventWriter: ListWriter) => void) =>
  settle(
    identifier
      ? app.get().use(BookmarkSets).update(identifier, fn)
      : app.get().use(BookmarkLists).update(fn),
  )

// Filing a bookmark twice in one folder would publish the tag twice, so the value goes first.
export const addBookmark = (tag: string[], identifier?: string) =>
  updateFolder(identifier, eventWriter =>
    eventWriter.dropTags(other => other[1] === tag[1]).addPublic(tag),
  )

export const createBookmarkFolder = (title: string) =>
  settle(command(writer(BookmarkSet).setIdentifier().setTitle(title)))

export const renameBookmarkFolder = (identifier: string, title: string) =>
  settle(
    app
      .get()
      .use(BookmarkSets)
      .update(identifier, eventWriter => eventWriter.setTitle(title)),
  )

const foldersHolding = (value: string) =>
  userBookmarkFolders.get().filter(folder => folder.bookmarks.some(tag => tag[1] === value))

const removeEach = async (folders: BookmarkFolder[], value: string) => {
  const errors = await Promise.all(
    folders.map(folder =>
      updateFolder(folder.identifier, eventWriter => eventWriter.dropTags(tag => tag[1] === value)),
    ),
  )

  return errors.find(Boolean)
}

// Unbookmarking is a toggle, so it clears the value from wherever the user filed it.
export const removeBookmark = (value: string) => removeEach(foldersHolding(value), value)

export const moveBookmark = async (tag: string[], to?: string) => {
  const from = foldersHolding(tag[1]).filter(folder => folder.identifier !== to)
  const errors = await Promise.all([addBookmark(tag, to), removeEach(from, tag[1])])

  return errors.find(Boolean)
}

export const deleteBookmarkFolder = async (identifier: string) => {
  const address = new Address(NAMED_BOOKMARKS, user.get().pubkey, identifier).toString()
  const set = app.get().use(BookmarkSets).get(address)

  if (set) {
    return settle(deletes.get().deleteEvent(set.event))
  }
}
