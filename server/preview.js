import * as nip19 from "nostr-tools/nip19"
import {Hono} from "hono"
import {load} from "cheerio"
import {ParsedType, parse, renderAsText, summarize} from "@welshman/content"
import {MINUTE, ellipsize, first, identity, int, ms, sleep, tryCatch} from "@welshman/lib"
import {
  displayRelayUrl,
  getIdFilters,
  isIPAddress,
  isShareableRelayUrl,
  normalizeRelayUrl,
} from "@welshman/util"
import {
  Article,
  Classified,
  Poll,
  Thread,
  TimeEvent,
  ZapGoal,
  displayPubkey,
} from "@welshman/domain"
import {LOCAL_RELAY_URL, MockAdapter} from "@welshman/net"
import {Domain, Network, Profiles, Relays, Rooms, createApp, makeRoomKey} from "@welshman/app"

const PLATFORM_NAME = process.env.VITE_PLATFORM_NAME

const fromCsv = value => (value || "").split(",").filter(identity)

const defaultRelays = fromCsv(process.env.VITE_DEFAULT_RELAYS).map(normalizeRelayUrl)

// Anyone can put any host in a url or an event's tags, so the server only reaches public relays.
const isPublicRelayUrl = url => isShareableRelayUrl(url) && !isIPAddress(url)

const toRelayUrl = value => {
  const url = tryCatch(() => normalizeRelayUrl(value))

  return url && isPublicRelayUrl(url) ? url : undefined
}

// Every socket goes through here, so a relay that isn't public refuses rather than being dialed.
const refuseRelay = url => {
  const adapter = new MockAdapter(url, ([verb, id]) => {
    if (verb === "REQ") {
      setTimeout(() => adapter.receive(["CLOSED", id, "blocked: not a public relay"]))
    }
  })

  return adapter
}

const app = createApp({
  getAdapter: url =>
    url === LOCAL_RELAY_URL || isPublicRelayUrl(url) ? undefined : refuseRelay(url),
  config: {
    getDefaultRelays: () => defaultRelays,
    getIndexerRelays: () => fromCsv(process.env.VITE_INDEXER_RELAYS).map(normalizeRelayUrl),
  },
})

const oneLine = text => ellipsize((text || "").replace(/\s+/g, " ").trim(), 200)

// A mention reads as a name rather than as bech32, so whoever is mentioned has to be loaded too.
const readEvent = async event => {
  if (event) {
    const parsed = parse(event)
    const mentions = parsed.filter(node => node.type === ParsedType.Profile)

    await Promise.all(mentions.map(node => app.use(Profiles).load(node.value.pubkey)))

    const getName = node =>
      node.type === ParsedType.Profile
        ? app.use(Profiles).get(node.value.pubkey)?.display()
        : undefined

    return oneLine(renderAsText(summarize(parsed, getName)).toString())
  }

  return ""
}

const decodePubkey = entity => {
  const decoded = tryCatch(() => nip19.decode(entity))

  if (decoded?.type === "npub") {
    return decoded.data
  }

  if (decoded?.type === "nprofile") {
    return decoded.data.pubkey
  }
}

const decodeEvent = entity => {
  const decoded = tryCatch(() => nip19.decode(entity))

  if (decoded?.type === "nevent") {
    return {id: decoded.data.id, relays: decoded.data.relays || []}
  }

  if (decoded?.type === "note") {
    return {id: decoded.data, relays: []}
  }

  if (decoded?.type === "naddr") {
    const {kind, pubkey, identifier, relays = []} = decoded.data

    return {id: [kind, pubkey, identifier].join(":"), relays}
  }
}

// A relay that never answers its nip-11 request would otherwise hold the page open indefinitely.
const loadSpace = async url => {
  const relay = await Promise.race([app.use(Relays).load(url), sleep(ms(2))])

  return {
    url,
    name: relay?.display() || displayRelayUrl(url),
    description: relay?.description,
    image: relay?.icon || relay?.banner,
  }
}

const loadEvent = (idOrAddress, relays) =>
  app
    .use(Network)
    .loadLenient({filters: getIdFilters([idOrAddress]), relays})
    .then(first)

// One describer per route, each naming the space or the platform whatever fails to load.

const describePerson = async entity => {
  const pubkey = decodePubkey(entity)

  if (pubkey) {
    const profile = await app.use(Profiles).load(pubkey)

    return {
      title: `${profile?.display() || displayPubkey(pubkey)} on ${PLATFORM_NAME}`,
      description: oneLine(profile?.about()) || `Someone on ${PLATFORM_NAME}.`,
      image: profile?.picture(),
    }
  }
}

const describeNote = async entity => {
  const pointer = decodeEvent(entity)

  if (pointer) {
    const event = await loadEvent(pointer.id, [...pointer.relays, ...defaultRelays])
    const author = event && (await app.use(Profiles).load(event.pubkey))

    return {
      title: author ? `A note by ${author.display()}` : `A note on ${PLATFORM_NAME}`,
      description: (await readEvent(event)) || `Somebody's note on ${PLATFORM_NAME}.`,
      image: author?.picture(),
    }
  }
}

const describeSpace = space => ({
  title: `${space.name} on ${PLATFORM_NAME}`,
  description: space.description || `${space.name} is a community on ${PLATFORM_NAME}.`,
})

const describeItem = (factory, noun) => async (space, params) => {
  const event = await loadEvent(params.id, [space.url])
  const title = event && app.use(Domain).reader(factory)(event).title()

  return {
    title: title ? `${title} in ${space.name}` : `${noun} in ${space.name}`,
    description: (await readEvent(event)) || space.description || `${noun} in ${space.name}.`,
  }
}

const describeRoom = async (space, params) => {
  const room = await app.use(Rooms).load(makeRoomKey(space.url, params.h))
  const name = room?.meta?.name()

  return {
    title: name ? `${name} in ${space.name}` : `A room in ${space.name}`,
    description: oneLine(room?.meta?.about()) || space.description || `Chat in ${space.name}.`,
  }
}

const requestUrl = context => {
  const url = new URL(context.req.url)
  const forwardedProto = context.req.header("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = context.req.header("x-forwarded-host")?.split(",")[0]?.trim()

  if (forwardedProto === "http" || forwardedProto === "https") {
    url.protocol = `${forwardedProto}:`
  }

  if (forwardedHost) {
    // The host setter leaves a port already on the url alone unless the new host carries one.
    url.port = ""
    url.host = forwardedHost
  }

  return url
}

const injectMetadata = (template, metadata, url) => {
  const $ = load(template)

  $("title").text(metadata.title)
  $('meta[property="og:title"]').attr("content", metadata.title)
  $('meta[name="twitter:title"]').attr("content", metadata.title)
  $('meta[name="description"]').attr("content", metadata.description)
  $('meta[property="og:description"]').attr("content", metadata.description)
  $('meta[name="twitter:description"]').attr("content", metadata.description)
  $('meta[property="og:image"]').attr("content", metadata.image)
  $('meta[name="twitter:image"]').attr("content", metadata.image)
  $('meta[property="og:url"]').attr("content", url.toString())
  $('meta[name="twitter:url"]').attr("content", url.toString())
  $('meta[name="twitter:site"]').attr("content", url.origin)
  $('link[rel="canonical"]').attr("href", url.toString())

  return $.html()
}

const cache = new Map()

// A preview costs a round trip to a relay, and a crawler asks for the same url several times.
const remember = async (key, describe) => {
  const cached = cache.get(key)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.metadata
  }

  // A relay that stalls leaves the page to go out without a preview rather than hold it open.
  const metadata = await Promise.race([describe(), sleep(ms(4))])

  if (metadata) {
    if (cache.size > 500) {
      cache.clear()
    }

    cache.set(key, {metadata, expiresAt: Date.now() + ms(int(5, MINUTE))})
  }

  return metadata
}

export const createPreview = template => {
  const renderTemplate = context => context.html(template, 200, {"Cache-Control": "no-cache"})

  const render = describe => async context => {
    const url = requestUrl(context)
    const metadata = await remember(url.pathname + url.search, () =>
      describe(url, context.req.param()),
    ).catch(error => console.error(`Failed to build a preview for ${url.pathname}:`, error))

    if (metadata) {
      const image = metadata.image || new URL("/maskable-icon-512x512.png", url.origin).toString()

      return context.html(injectMetadata(template, {...metadata, image}, url), 200, {
        "Cache-Control": "no-cache",
      })
    }

    return renderTemplate(context)
  }

  // A space relay answers nothing without auth, so most of these fall back to its nip-11 profile.
  const renderSpace = describe =>
    render(async (url, params) => {
      const relayUrl = toRelayUrl(params.relay)

      if (relayUrl) {
        const space = await loadSpace(relayUrl)

        return {image: space.image, ...(await describe(space, params))}
      }
    })

  const preview = new Hono()

  preview.get(
    "/join",
    render(async url => {
      const relayUrl = toRelayUrl(url.searchParams.get("r"))

      if (relayUrl) {
        const space = await loadSpace(relayUrl)

        return {
          title: `Join ${space.name} on ${PLATFORM_NAME}`,
          description:
            space.description || `You are invited to join ${space.name} on ${PLATFORM_NAME}.`,
          image: space.image,
        }
      }
    }),
  )

  preview.get(
    "/people/:npub",
    render((url, params) => describePerson(params.npub)),
  )
  preview.get(
    "/notes/:nevent",
    render((url, params) => describeNote(params.nevent)),
  )

  preview.get(
    "/:entity{(npub|nprofile|nevent|note|naddr)1[a-z0-9]+}",
    render(
      async (url, params) => (await describePerson(params.entity)) || describeNote(params.entity),
    ),
  )

  preview.get("/spaces/create", renderTemplate)
  preview.get("/spaces/:relay", renderSpace(describeSpace))
  preview.get("/spaces/:relay/admin", renderSpace(describeSpace))

  preview.get(
    "/spaces/:relay/about",
    renderSpace(space => ({
      title: `About ${space.name}`,
      description: space.description || `What ${space.name} is and who it is for.`,
    })),
  )

  preview.get(
    "/spaces/:relay/chat",
    renderSpace(space => ({
      title: `Chat in ${space.name}`,
      description: space.description || `Everybody in ${space.name} talks here.`,
    })),
  )

  preview.get(
    "/spaces/:relay/directory",
    renderSpace(space => ({
      title: `Members of ${space.name}`,
      description: `Who is in ${space.name}, and where they are.`,
    })),
  )

  preview.get(
    "/spaces/:relay/library",
    renderSpace(space => ({
      title: `Library of ${space.name}`,
      description: `What ${space.name} has collected and kept.`,
    })),
  )

  preview.get(
    "/spaces/:relay/calendar",
    renderSpace(space => ({
      title: `Calendar of ${space.name}`,
      description: `What ${space.name} has coming up.`,
    })),
  )

  preview.get(
    "/spaces/:relay/threads",
    renderSpace(space => ({
      title: `Threads in ${space.name}`,
      description: `Longer conversations in ${space.name}.`,
    })),
  )

  preview.get(
    "/spaces/:relay/polls",
    renderSpace(space => ({
      title: `Polls in ${space.name}`,
      description: `What ${space.name} is deciding.`,
    })),
  )

  preview.get(
    "/spaces/:relay/goals",
    renderSpace(space => ({
      title: `Goals of ${space.name}`,
      description: `What ${space.name} is raising money for.`,
    })),
  )

  preview.get(
    "/spaces/:relay/classifieds",
    renderSpace(space => ({
      title: `Classifieds in ${space.name}`,
      description: `What ${space.name} is buying and selling.`,
    })),
  )

  preview.get(
    "/spaces/:relay/articles",
    renderSpace(space => ({
      title: `Articles in ${space.name}`,
      description: `Long-form writing from ${space.name}.`,
    })),
  )

  preview.get("/spaces/:relay/articles/create", renderTemplate)
  preview.get("/spaces/:relay/calendar/:id", renderSpace(describeItem(TimeEvent, "An event")))
  preview.get("/spaces/:relay/threads/:id", renderSpace(describeItem(Thread, "A thread")))
  preview.get("/spaces/:relay/polls/:id", renderSpace(describeItem(Poll, "A poll")))
  preview.get("/spaces/:relay/goals/:id", renderSpace(describeItem(ZapGoal, "A goal")))
  preview.get("/spaces/:relay/classifieds/:id", renderSpace(describeItem(Classified, "A listing")))
  preview.get("/spaces/:relay/articles/:id", renderSpace(describeItem(Article, "An article")))
  preview.get("/spaces/:relay/:h", renderSpace(describeRoom))

  // The built index.html already describes the platform, which is all any other route is about.
  preview.get("*", renderTemplate)

  return preview
}
