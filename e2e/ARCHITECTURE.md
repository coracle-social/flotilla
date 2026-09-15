# E2E architecture

Flotilla's end-to-end suite runs the real app against a relay network that is entirely under the
test's control. Nothing in this directory opens a connection to a host the test did not create.

## The relay

Every spec runs against a real [zooid](https://github.com/coracle-social/zooid) relay in Docker, the
implementation Flotilla is built for, so protocol drift between the client's assumptions and a real
relay shows up as a failing test.

zooid is multi-tenant: it binds a config to a `Host` header and serves any number of virtual relays
from one process. `harness/zooid/config.ts` names them, one toml apiece in `harness/zooid/docker/`,
and a scenario picks one by name. A second space costs a config file and no extra process, which is
what keeps outbox routing and cross-space isolation testable.

A relay's policy is its toml and nothing else. A scenario says what is _on_ a relay — its rooms, its
members, its messages — never what the relay _is_, so there is no policy negotiation anywhere in the
harness. `space` and `other` are the same permissive policy, for specs that need two relays; `closed` refuses a join that carries no invite claim, which is what raises "Request
Access"; `unsigned` serves events with their signatures stripped, which is what raises "Do you trust
this space?". Seeding a membership on `closed` is therefore not possible — `join()` and `member()`
publish a claimless join and the relay refuses it — so a scenario there seeds admin-created rooms
and lets the spec do the joining.

`indexer` and `outbox` are not spaces: groups are off, anyone may read and write, and nothing seeded
on them carries an `h` tag. They are what "The follow graph" below is made of.

### Why the relays are called `<name>.test`

The container listens on plaintext loopback, but a url that is local or insecure is dropped from
every relay selection unless the caller opts in — see `isLocalUrl` and `RelaySelection.getUrls` in
`@welshman/util` — and the app never opts in, since in production neither belongs in a routing
decision. Handed `ws://localhost:3334/`, the client would load a space by its explicit url and
resolve nothing else: no outbox loads for profiles or relay lists, no relay hints.

So the client is given `wss://space.test/` and never learns the container has an address. Everything
that speaks to it goes through `zooid/transport.ts`, which dials `127.0.0.1:3334` carrying the two
headers a TLS terminator adds in front of a real deployment:

- `Host: space.test` — zooid's dispatcher binds a config to a Host (`cmd/relay/main.go`), so this is
  what selects which toml answers.
- `X-Forwarded-Proto: https` — khatru derives the url it checks NIP-42 and NIP-86 signatures against
  from Host plus this (`getBaseURL` in `khatru/relay.go`), arriving at `wss://space.test/`, which is
  exactly what the client signed into its `relay` tag. Seeding signs the same url, so a fixture is
  written over the same relay the app talks to.

`.test` is reserved by RFC 2606 and resolves nowhere, so a url that ever escapes this process fails
to connect rather than reaching a host.

## Transport: one interception point

All relay traffic is intercepted in the **Node** process via Playwright's `routeWebSocket`, applied
to the `BrowserContext` so every page in it is covered:

```
browser context ──▶ context.routeWebSocket(everything but vite's hmr socket)
                          │
                          ▼
                  zooid.relays.get(url)
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
  a socket this process opens         unknown url: a relay that
  to the container, as that           holds no events, and the
  relay's virtual host                url is recorded as a leak
```

Every socket the browser opens is terminated in the node process, and the only one that leaves
is the loopback connection `zooid/transport.ts` makes to the container the test started.
`assertNoLeaks()` fails a test that touched a url the scenario never declared.

Because the branch is taken per socket rather than once, retention is expressible here too:
`forgetRelay(context, url)` sends that context down the empty-relay side from its next connection
on, without the url becoming a leak. A reload after it is a client coming back to a relay that has
dropped what it was holding, which is what separates history a client kept from history it is
reading back off the wire.

Silence is expressible the same way, and it is the fault a client cannot see: a relay that takes the
socket and then sends nothing at all leaves every request it was given indistinguishable from one
still in flight. `as(user, path, {silent: [url]})` is that from the first connection, which is where
a spec about a page failing to fill needs it; `silenceRelay(context, url)` applies it mid-test. Such
a url needs no tenant behind it, since nothing it says is ever served.

Interception is installed by `as()` and `visit()`, on a context each of them creates, so a page that
came from anywhere else has none of it. Playwright's own `context` fixture — and the `page` fixture
built on it — is therefore overridden to throw, so a spec written the ordinary way fails immediately
with a message saying so rather than quietly dialling the relays in `.env`. The built-in `request`
fixture goes the same way: an `APIRequestContext` is an http client in the node process that belongs to no browser
context, so the block-all below cannot see it and nothing records what it sent.

`playwright` is the one fixture left alone, because it is where the run's own browser comes
from, so every test would fail if it threw. A spec that goes around `as()` through
`playwright.request` or `playwright.chromium.launch()` reaches the network unwatched, and no fixture
can refuse that without refusing the suite.

Interception in Node rather than in the page enables multi-user testing. Three browser
contexts logged in as three different users all dispatch into the _same_ relay, so one user
genuinely observes another user's writes, over the wire, through the client's real socket stack.

### Why not an `AdapterFactory`

An `AdapterFactory` backed by a `Repository`-backed adapter cannot test authentication. NIP-42 lives on `Socket`: `AuthState` listens to `SocketEvent.Receiving`/
`Sending`, and `socketPolicyAuthBuffer` replays messages that were rejected with `auth-required:`.
An `AbstractAdapter` whose `sockets` getter returns `[]` never constructs any of that. Patching the
transport instead leaves `Pool → Socket → SocketAdapter` untouched, so auth, message buffering,
replay-after-auth and reconnect are all exercised as written.

## HTTP

Relays are not the only egress. `installHttpRoutes` routes every url that is not the dev server — a
predicate rather than a `"**/*"` pattern, so the hundreds of module requests a sveltekit page makes
in dev are never matched — and aborts what it catches. Two origins get past it: the dev server
on `localhost:1847`, which is left unrouted, and each relay's own origin, which is forwarded to the
container by the same transport carrying the same two headers, so the NIP-11 document and the NIP-86
management API the app reads are the real relay's answers, signed against the url the client used.
Every other request is aborted and recorded.

A relay's NIP-11 document decides whether a space is synced by reconciliation or a plain REQ
(NIP-77), whether a message the UI composes carries a protected `-` tag (NIP-70), what the space is
called, and which pubkey room state is trusted from. Its NIP-86 answers decide whether the user is an
admin, since a relay refuses management calls from anyone else and the method list that comes back
doubles as the client's permission set — the space, room, event and pin menus, the directory and the
library are all gated on it.

Services the app talks to are mocked per-scenario, so a blocked request is always a bug
rather than ambient noise: Dufflepud (`dufflepud.coracle.social`), Blossom uploads, the push server
(`nps.flotilla.social`), the hosting API, LiveKit token endpoints, and image/thumbnail fetches. The
analytics script hard-coded in `src/app.html` is mocked with an empty body to avoid making
`assertNoBlockedRequests()` a statement about the page shell rather than about the test.

Two of those answers are the scenario's own. NIP-11 fields a spec names are merged over the relay's
real document — a `redirect_to`, a `limitation`, a NIP the relay does not implement — rather than
replacing it, because `self`, `pubkey` and `supported_nips` are what room state is trusted from, and
the merge is installed with the page, since the document is read at startup and cached from then on.
The hosting API is a small stateful fake rather than fixed answers: a write mutates the record it
names and the next read sees it, so editing a space, deactivating it or paying an invoice is
observable. `getHosting(context)` changes the backend's mind between two of the user's clicks — a
custom domain that verifies, an invoice that gets paid.

## Containment

A browser has a fixed set of ways to put bytes on a wire.

| how the app can reach the network                                   | what stops it                                                                                                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebSocket` — `@welshman/net`'s `Socket`, the only constructor call | `context.routeWebSocket(url => !isDevServerUrl(url))`. Terminated in node; an undeclared url gets a relay holding nothing and `assertNoLeaks()` fails the test |
| `fetch` / `XMLHttpRequest` — app code, welshman, `@pomade/core`     | `context.route(url => !isDevServerUrl(url))`, which aborts unless a mock registered later answers first                                                        |
| `img`, `script`, `link`, fonts, media, and every other subresource  | the same route. Images never reach it — `mockImages` answers anything with `resourceType() === "image"` with a 1×1 png                                         |
| navigation, including the external links the ui offers              | the same route: a document request is routed like any other, and a popup opens in the context that owns it                                                     |
| `EventSource`                                                       | the same route. Neither `src` nor welshman constructs one                                                                                                      |
| `navigator.sendBeacon`                                              | no call site. The one script that would use it is the plausible tag in `src/app.html`, served with an empty body                                               |
| a service worker                                                    | `serviceWorkers: "block"` on the context. Playwright does not route a worker's requests, so the worker is refused instead                                      |
| a web worker                                                        | no call site in `src`; `@pomade/core`'s is argon2, which is cpu and no socket                                                                                  |
| Capacitor's native http and push plugins                            | not reachable from a browser, and the zooid config leaves `[push]` disabled so nothing is asked to register                                                    |

Two connections leave this process, both to something the test started: the browser's to the vite dev
server on `localhost:1847`, and `zooid/transport.ts`'s to `127.0.0.1:3334`. Everything else the app
initiates dies in node.

The two ends are enforced differently. A websocket to a url no scenario declared is answered rather
than refused — by a relay that EOSEs every REQ and accepts every event into the void — and the url is
recorded, so the test fails on `assertNoLeaks()` naming it rather than on a timeout somewhere
downstream. An http request nothing mocked is aborted outright, but noticing it is opt-in:
`assertNoBlockedRequests()` is for a spec that has mocked what it exercises, because some of what a
page asks for is meant to be refused.

Configuration is the other half. `boot()` overrides every `VITE_` value that names a relay — default,
indexer, search, messaging, signer, platform, blocked, the default space list — with the scenario's
own urls, through the hook `src/app/env.ts` reads them with, and points `VITE_PUSH_BRIDGE` at `ws://localhost:1/`, which nothing serves, so a push
bridge connection is reported as a leak rather than blending into a relay's traffic. The `VITE_`
values it does not override still name real hosts — the blossom server, the pomade signers, the
thumbnail service, the push server, the hosting api — and none of them is contacted at boot. Blossom
is read only when an upload starts, the thumbnail url only on android, pomade only when a signup uses
it, and the hosting api and dufflepud are mocked. They are contained by the block-all rather than by
configuration.

Grepping the repo for hostnames accounts for all of them, and there are only three kinds. Most are an
`href` in help text — nostr.com, nostrapps.com, nsec.app, nosta.me, nostr.how, github.com,
fountain.fm, cal.com, figma.com, coracle.tools, gitea.coracle.social, nwc.getalby.com, and the
`coracle.social` entity links `src/app/env.ts` builds — reachable only by clicking, and routed if
clicked. Two are fetched: dufflepud, whose origin is the one service url hard-coded rather than read
from `VITE_`, and the plausible tag in `src/app.html`. Both are mocked. The rest are in comments.
Under `e2e` the only hostnames are the four service origins `net/http.ts` matches on, the virtual
relays' own `.test` names, and the loopback address `zooid/transport.ts` dials.

Three things this does not cover:

- **WebRTC.** `livekit-client` opens an `RTCPeerConnection`, and Playwright cannot see one. A voice
  or video room reaches its sfu over ice and dtls with nothing in between. `mockLivekit` decides
  where the client is pointed, which is why its `serverUrl` has to be something the test owns, and
  why `[livekit]` is omitted from the zooid config entirely. A spec that joins a call escapes this
  document's guarantee and needs its own answer.
- **Playwright's own fixtures.** `context`, `page` and `request` are overridden to throw, but
  `playwright` cannot be — it is where the browser comes from. A spec that reaches the network
  through `playwright.request` or `playwright.chromium.launch()` is unwatched.
- **The browser itself.** A browser's own traffic is not the app's and is not routed. Playwright
  launches chromium with `--disable-background-networking`, `--disable-component-update` and
  `--disable-breakpad`, which is the whole of the mitigation, and which is chromium's alone —
  `E2E_BROWSER=firefox` or `webkit` runs the suite under an engine those flags say nothing about.

## Determinism without freezing the clock

Timestamps are never patched. Instead every fixture is generated fresh at the start of each test and
signed with timestamps relative to the moment the test began:

```ts
const scenario = await seed(({relay, user, at}) => {
  const space = relay("space")
  space.room("general", {name: "General"})
  space.join(user.alice, "general")
  space.join(user.bob, "general")
  space.message(user.alice, "general", "morning all", at(2, HOUR))
  space.message(user.bob, "general", "morning!", at(90, MINUTE))
})
```

`at(2, HOUR)` is `now() - int(2, HOUR)` evaluated once per test, so "2 hours ago" renders the same
way on every run without the app's `now()` being touched. Fixtures are published over a real socket,
authenticated as the identity that signed them, so the relay stores exactly what it would have stored
for a real client: there are no pre-signed JSON blobs to drift out of date, and a fixture the relay
would have refused fails the test instead of appearing in a query.

## Users and sessions

Test identities are deterministic secp256k1 keypairs derived from fixed secrets (`alice`, `bob`,
`carol`, `admin`), so a pubkey is stable across runs and can be asserted on directly.
`makeTestUser(name)` derives a fifth, sixth or hundredth one from its name and registers it, for the
directory and search specs that need more people than there are named ones.

A logged-in user is created by injecting a NIP-01 session before the app boots. `src/app/session.ts`
carries a DEV-only hook: `restoreSession()` prefers `window.__TEST_SESSION__` when it is present, and
`window.__TEST_EVENTS__` becomes the repository contents a returning user's client would have found
on disk. Both branches are stripped from production builds, and injecting through the hook avoids
writing Capacitor's `SecureStorage`/`Preferences` localStorage encoding by hand.

The injected events go in _after_ `storage.ready`. Storage loads what the last session left behind
with `Repository.load`, which clears the repository before inserting, so anything put there while
IndexedDB is still opening is wiped a few milliseconds later — before the layout has rendered
anything, and long before `authPolicy` reads the room list to decide whether to answer a relay's AUTH
challenge.

The cache exists for the harness rather than for the app. In production the client bootstraps itself:
asking a keyed collection for a pubkey loads it, so `authPolicy` reading the user's room and relay
lists to decide whether to answer a challenge is itself what fetches them, as is any outbox-routed
load of the user's own data. Kind-10002 comes back from the public indexers, and `syncRelayList`
cascades into the room list from there.

Here the indexers _are_ the scenario's relays, because `boot()` points every relay list at them, and
those are members-only — so that first load is refused with `auth-required:`, while `authPolicy`,
conservative by default, will not sign for a url no list has named yet. Each waits on the other. The
injected room list breaks the circle, and it is what a user who joined a space through the UI would
have on disk anyway.

The price is that no spec exercises the bootstrap: every one of them starts already knowing which
relays it belongs to, so a regression in the chain from relay list to room list, or in `authPolicy`'s
conservative gate, leaves the suite green. The public relays under "The follow graph" are the
standing-in indexer that covering it would need.

Each user is a separate `BrowserContext`, which also gives each one its own IndexedDB and
localStorage, so nothing bleeds between users.

An injected session is re-applied on every navigation, so through `as()` a reload, a logout and a
login are all unobservable. `visit(path, options)` is the same page without one — same context, same
interception, same env — and it is what a spec that watches someone arrive, sign in and come back
starts from. Both take the same options, over and above the scenario's own relays:

| option      | what it does                                                                         |
| ----------- | ------------------------------------------------------------------------------------ |
| `context`   | merged over the project's context options: a viewport, a colour scheme, a permission |
| `env`       | `VITE_` values applied over the ones derived from the scenario's relays              |
| `nip07`     | a `window.nostr` backed by that identity's own signer, for an extension login        |
| `webln`     | a `window.webln` that answers the connection handshake, for connecting a wallet      |
| `relayInfo` | fields merged over a relay's own NIP-11 document, keyed by relay url                 |
| `hosting`   | what the hosting backend already knows about this user                               |

Whatever `env` names still has to be something the scenario owns — a platform relay, the domain
hosted spaces are created under — or the app dials a host nothing serves and the test fails on a
leak. The NIP-07 provider is a real signer rather than a stub, because the session it produces has to
sign the NIP-42 challenges the members-only relays send.

## The follow graph

Everything `/home`'s network column is made of sits outside a space: a follow list, each followed
pubkey's relay list, and an indexer to resolve those from. `open("indexer")` and `open("outbox")`
are the two public relays that hold it, and a scenario says which of them a given fixture lands on:

```ts
const scenario = await seed(({relay, open, user, at}) => {
  const space = relay("space")
  const indexer = open("indexer")
  const outbox = open("outbox")

  space.room("general", {name: "General"})
  space.join(user.alice, "general")

  indexer.relayList(user.alice, {
    read: [space.url, indexer.url],
    write: [space.url, indexer.url, outbox.url],
  })
  indexer.follows(user.alice, [user.bob])

  indexer.relayList(user.bob, {read: [outbox.url], write: [outbox.url]})
  outbox.profile(user.bob, {name: "Bob Barker"})
  outbox.note(user.bob, "the lighthouse has been dark since tuesday", at(30, MINUTE))
})
```

Bob is in none of alice's spaces, so the only thing that can put his note on her screen is his relay
list. Keeping the indexer and the outbox apart is what makes that assertable: a client that ignored
the list would ask the indexer, find nothing, and fail the spec, where one relay serving both roles
would pass either way. `VITE_INDEXER_RELAYS` points at the indexer as soon as a scenario opens one,
and at the scenario's spaces otherwise, which is what every spec written before there was one still
gets.

An open relay's url reads before seeding has run, unlike a space's, because a relay list has to name
the relay a note is seeded on.

### Why a reader has to name the relays it reads from

zooid answers no REQ without NIP-42, whatever `public_read` says, and `authPolicy` is conservative:
it identifies only to relays the user's own room list or relay list names. So a relay a spec expects
the client to read from has to appear in that user's list, and a relay list is seeded for the reader
as well as for the people they follow.

Read and write are separate there, and the difference is what a routing assertion hangs on. Above,
alice writes to bob's relay and reads from her space and the indexer: the write url is enough for
her client to identify to it, while a feed's context, which is built from her read urls, has no
reason to ask it for anything. A reply that only lives on bob's relay therefore counts only if the
feed asked the relay the note itself came from.

The write urls have a second job. A user's own follow list is loaded through their outbox, so the
relay a scenario seeds that list on has to be one of the relays their list says they write to — the
indexer, here. Seed it somewhere they only read from and the feed comes up empty with nothing to say
why.

Her own relay list reaches her client as cache alongside her room list, for the same reason the room
list does: it is the list that says which relays may be identified to, so it cannot be the thing
that has to be fetched first.

## Layout

```
e2e/
  ARCHITECTURE.md          this document
  harness/
    index.ts               everything a spec imports: `test`, `expect`, helpers
    keys.ts                deterministic keypairs
    ui.ts                  the locators specs share: dialogs, the composer, a room's messages
    files.ts               the bytes an upload spec picks, and the browser's own file chooser
    zooid/
      config.ts            the virtual relays and their hosts — the one place they are named
      relay.ts             docker lifecycle, reset, seeding over its own authenticated socket
      transport.ts         the only thing that knows the container's address: ws and http to it
      testRelay.ts         the seeding affordances a scenario builds on
      types.ts             TestRelay, RoomOptions, RelayConnection
      docker/
        compose.yaml       no data volume; tmpfs for /app/data and /app/media
        config/            one toml per virtual relay: its host, and its whole policy
    net/
      websocket.ts         routeWebSocket install, dispatch, transcript, leak detection
      http.ts              block-all + per-service mocks
    app/
      boot.ts              env overrides, navigate, wait for mount and for the app to have read
                           the overrides
      session.ts           NIP-01 session injection
      nip07.ts             a window.nostr backed by a test identity's own signer
      webln.ts             a window.webln that enables and reports what it supports
    seed/
      scenario.ts          the `seed()` builder and relative-time helpers
      publish.ts           the queue every seeding call goes through, and what it hands back
      space.ts             one space's fixtures: rooms, members, messages, replies, profiles,
                           direct messages, and anything a domain writer renders
      openRelay.ts         one public relay's fixtures: relay lists, follow lists, profiles, notes
  specs/
    *.spec.ts
```

A locator lives in the spec that uses it until a second spec needs the same one, at which point it
moves to `harness/ui.ts`. The class or the aria label it names is then one edit when the app renames
it, and the comment saying why it is shaped that way has one copy to keep true. What stays local is
what one spec means differently: `dms.spec.ts` names a message by its `data-event` id, because the
same words are sent more than once there.

One piece lives outside this directory: `src/lib/test/session.ts` holds the two window keys and the
getters `src/app/session.ts` reads them through. It is the only file the app ships on the harness's
behalf, and `harness/app/session.ts` duplicates the key names rather than importing them, since
importing anything under `src` would pull sveltekit into the node process.

## Resetting between tests

`Zooid.reset()` recreates the container rather than restarting it: with no volume mounted for
`/app/data`, storage lives in the container's writable layer and a tmpfs, so a fresh container is a
fresh database. What it mounts as its config is a copy of `docker/config`, staged outside the repo
and refreshed on the way up — zooid saves a relay's toml back when a NIP-86 call edits its name — so
every test starts against the same relays with nothing in them. The container is a worker fixture,
so the docker start-up cost is paid once per worker rather than once per test.

It is recreated in the teardown of the test that finishes, not the setup of the one that starts.
Creating a container tears down a veth pair and builds another, and the bridge behind it loses
carrier with them; chromium watches the host's interfaces and aborts everything it has in flight
when they move, which the app meets as a route chunk that failed to import and, with `ssr = false`,
a 500 page.
Recreating from teardown puts the next test's seeding — an authenticated socket per identity, and
every fixture written over it — between the churn and the first page that test opens. That is not
on its own enough: every netlink event lands before `compose up --wait` returns, but chromium
coalesces interface changes for up to two seconds before acting on one. So a recreate also stamps
the moment it settles, and a page waits out whatever is left of that window when it opens — which
for most tests is nothing, the teardown and the seeding having spent it already.

Seeding then writes over a real authenticated socket, one per identity per relay, held open for the
rest of the test. A fixture must therefore be signed by an identity `harness/keys.ts` holds, since
zooid authenticates every write.

Anything richer than a room message is built by the domain writers the app itself publishes with:
`space.kind(Article)` hands back the kind configured against this space, and `space.event(user, () =>
…renderTemplate())` defers the render until the space has a url to render hints against, which is
only true once the queue has drained. A NIP-17 conversation is `space.dm(from, to, content)`: it
gift-wraps one rumor per participant and publishes each wrap over the sender's connection, since a
wrap is signed by an ephemeral key nobody here can authenticate as. zooid stores it anyway, because
it authorizes a kind-1059 by the member named in its `p` tag — and refuses one addressed to a
stranger.

## Running

The suite is not run by agents (see CLAUDE.md).

```sh
pnpm exec playwright install                          # once
docker pull gitea.coracle.social/coracle/zooid:latest # once; the harness never pulls
pnpm test                                             # starts and stops the container itself
```

Every test skips when docker is unavailable, rather than failing.

A test fails when the app broke while it ran, whatever it asserted: an uncaught exception on any
of its pages, or code of ours the browser refused under the content security policy. A refusal
reaches the console and nothing else, which is how a policy that had rotted past the script it
names stayed invisible to every spec for a week (#535). A failed request or a warning is neither,
and a dev server is full of both, so those are logged and left alone — as is the route chunk
sveltekit loses when the per-test container churns the network out from under it (#529).

Either way a failing test attaches `browser-console`, everything both sides said. `use.trace` and
playwright's own reporting only cover contexts playwright made itself, and the harness makes its
own, so without that attachment a failure carries the DOM snapshot and nothing the app said —
which is unreadable when what failed is the app rendering its error page.

One engine per run. These specs exercise sockets, auth and sync, so running them under three
engines adds little coverage. `E2E_BROWSER=webkit pnpm test` runs the whole
suite under another one. The container listens on a fixed port and cannot be sharded, so
`workers` is 1.

`src/app/env.ts` resolves every `VITE_` value through a DEV-only hook that prefers
`window.__TEST_ENV__`, which `boot()` injects per browser context, so any dev server will do and a
server already listening on `:1847` is reused. `boot()` still checks that the app read the injected
values, and fails naming the hook rather than letting a run drift onto the relays in `.env`.
