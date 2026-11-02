---
name: welshman-content
description: "Use this skill when working with @welshman/content: parsing nostr note content, extracting mentions/links/media/topics, or rendering parsed content to HTML or custom formats."
---

# welshman/content — Note Content Parsing

`@welshman/content` parses nostr event content into typed elements (links, profiles, events, topics, media, etc.) and renders them back to text or HTML. It depends on no other welshman package.

## Installation

```bash
npm install @welshman/content
# or
pnpm add @welshman/content
yarn add @welshman/content
```

## Key Exports

### Parsing

| Export | Description |
|--------|-------------|
| `parse({ content?, tags? })` | Main entry point. Parses a content string (and optional event tags) into a `Parsed[]` array. Falls back to the `alt` tag if content is empty. |
| `truncate(content, opts?)` | Truncates a `Parsed[]` array, appending an `Ellipsis` element. Leaves content unchanged if it fits within `maxLength`. |
| `reduceLinks(content)` | Collapses consecutive block-level links (each on its own line) into a single `LinkGrid` element. |
| `urlIsMedia(url)` | Returns `true` if the URL string has an image, audio or video extension (jpg, png, gif, webp, mp3, mp4, etc.). |

### Parsed Types

`ParsedType` enum values and their corresponding type shapes:

| `ParsedType` | `value` type | Notes |
|---|---|---|
| `Text` | `string` | Plain text |
| `Newline` | `string` | One or more `\n` characters |
| `Topic` | `string` | Hashtag text without the `#`; numeric-only tags are skipped |
| `Command` | `{ command: string, pubkey?: string }` | A NIP-CD invocation (`/kick`, `/kick@npub1…`) at the start of the content; `pubkey` is the executor the qualifier names |
| `Link` | `{ url: URL, meta: Record<string, string> }` | `http`, `https`, `ws` and `wss` URLs only, since renderers put the url in an href; other schemes (`javascript:`, `data:`, `ftp:`, …), bare domains and URLs containing `..` are not links. `meta` is populated from `imeta` tags and URL hash params |
| `LinkGrid` | `{ links: ParsedLinkValue[] }` | Produced by `reduceLinks`; a collection of adjacent block links |
| `Profile` | `ProfilePointer` (`{ pubkey, relays? }`) | npub / nprofile references, with optional `@` and `nostr:` prefixes |
| `Event` | `EventPointer` (`{ id, relays?, author?, kind? }`) | note / nevent references |
| `Address` | `AddressPointer` (`{ identifier, pubkey, kind, relays? }`) | naddr references |
| `Emoji` | `{ name: string, url?: string }` | `:shortcode:` — `url` resolved from `emoji` tags |
| `Room` | `ParsedRoomValue` (`{ url, room }`) | A NIP-29 room reference written as `relay.example.com'roomid` (an apostrophe or `’` between host and room id). The url is normalized to include a protocol and trailing slash. Possessives like `example.com's` are skipped |
| `Code` | `string` | Backtick inline code or triple-backtick blocks |
| `Cashu` | `string` | cashu: token strings |
| `Invoice` | `string` | Bare lightning invoice string (without `lightning:` prefix); the `lightning:` prefix is in `raw` |
| `Email` | `string` | Email addresses (with or without `mailto:`) |
| `Ellipsis` | `string` | Appended by `truncate` to indicate truncated content |

Every `Parsed` element also has a `raw: string` field holding the original matched text (empty string for synthetic elements like `LinkGrid` and `Ellipsis`).

### Type Guards

All guards narrow the `Parsed` union:

```
isAddress  isCashu    isCode     isCommand  isEllipsis
isEmail    isEmoji    isEvent    isImage    isInvoice
isLink     isLinkGrid isNewline  isProfile  isRoom
isText     isTopic
```

`isImage(parsed)` is true only for `ParsedLink` elements whose URL ends in `.jpg/.jpeg/.png/.gif/.webp`.

### Rendering

| Export | Description |
|--------|-------------|
| `renderAsText(parsed, options?)` | Renders `Parsed \| Parsed[]` to a `Renderer`; call `.toString()` to get a string. Links render as full URLs and entities as their full bech32 string, because the text `renderLink` returns the href and drops the `renderEntity` display text. |
| `renderAsHtml(parsed, options?)` | Same, but produces escaped HTML with `<a>` tags and sanitized hrefs. Default `entityBase` is `https://njump.me/`. |
| `render(parsed, renderer)` | Low-level: renders into an existing `Renderer` instance. |
| `makeTextRenderer(options?)` | Creates a `Renderer` pre-configured for text output. |
| `makeHtmlRenderer(options?)` | Creates a `Renderer` pre-configured for HTML output. |
| `Renderer` | Class with `addText`, `addLink`, `addEntityLink`, `addNewlines`, `toString`. |
| `summarize(parsed, getName?)` | Replaces every element that is not prose (entities, links, invoices) with `Text` naming it — "another message", "a link to example.com", "an image". Returns `Parsed[]`, so it composes with `truncate`, `reduceLinks` and either renderer. |
| `defaultSummaryName(parsed)` | The name `summarize` uses for an element its `getName` returned `undefined` for, or `undefined` itself for prose. |

`RenderOptions` fields (all optional when using the convenience functions):

| Field | Default (HTML) | Description |
|---|---|---|
| `newline` | `"\n"` | String emitted for each newline character |
| `escapeText(value)` | Escapes HTML via `innerText` | Applied to every text run (identity for text rendering) |
| `entityBase` | `"https://njump.me/"` | Base URL prepended to bech32 entity strings |
| `renderLink(href, display)` | `<a href=... target=_blank>display</a>` | Custom link HTML/text |
| `renderEntity(entity)` | `entity.slice(0, 16) + "…"` | Display text for entity links |
| `createElement(tag)` | `document.createElement(tag)` | DOM element factory; override for SSR/non-browser |

Individual per-type render helpers are also exported (`renderText`, `renderLink`, `renderProfile`, `renderEvent`, `renderAddress`, `renderRoom`, `renderTopic`, `renderEmoji`, `renderCode`, `renderCommand`, `renderCashu`, `renderInvoice`, `renderEmail`, `renderNewline`, `renderEllipsis`, `renderOne`, `renderMany`), along with the default option bags `textRenderOptions` and `htmlRenderOptions`.

### Extending the parser

`parsers` is the ordered array of individual parsers (`parseCommand`, `parseNewline`, `parseLegacyMention`, `parseTopic`, `parseCodeBlock`, `parseCodeInline`, `parseAddress`, `parseProfile`, `parseEmoji`, `parseEvent`, `parseCashu`, `parseInvoice`, `parseEmail`, `parseRoom`, `parseLink`), and `parseNext(raw, context)` runs them in order at the current position. Each takes `(text, context: ParseContext)` and returns a `Parsed` or nothing. Order matters — `parseRoom` runs before `parseLink` so a `host'room` reference isn't swallowed as a bare-domain link.

## Common Patterns

### Parse and render a note to HTML

```typescript
import { parse, renderAsHtml } from '@welshman/content'

const event = {
  content: "Hello #nostr! Check out nostr:npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn",
  tags: []
}

const parsed = parse({ content: event.content, tags: event.tags })
const html = renderAsHtml(parsed, {
  entityBase: 'https://njump.me/',
  renderEntity: (entity) => entity.slice(0, 12) + '…',
}).toString()
// → 'Hello nostr! Check out <a href="https://njump.me/nprofile1..." target="_blank">nprofile1qqs…</a>'
```

### Truncate long notes for a feed preview

```typescript
import { parse, truncate, reduceLinks, renderAsHtml } from '@welshman/content'

const parsed = parse({ content: event.content, tags: event.tags })
const withGrids = reduceLinks(parsed)
const preview = truncate(withGrids, { minLength: 300, maxLength: 500 })
const html = renderAsHtml(preview).toString()
```

### Read a message as one line of prose

```typescript
import { parse, ParsedType, renderAsText, summarize } from '@welshman/content'

// Names each entity, for a notification body or a speech synthesizer
const summary = renderAsText(
  summarize(parse({ content, tags }), p => {
    if (p.type === ParsedType.Profile) {
      return profilesByPubkey.get(p.value.pubkey)?.name
    }
  }),
).toString()
// → 'hodlbod said another message look at an image'
```

### Extract all mentioned pubkeys

```typescript
import { parse, isProfile, isAddress } from '@welshman/content'

const parsed = parse({ content: event.content, tags: event.tags })

const pubkeys = parsed
  .filter(isProfile)
  .map(p => p.value.pubkey)

const addressPubkeys = parsed
  .filter(isAddress)
  .map(p => p.value.pubkey)
```

### Extract all links and check for images

```typescript
import { parse, isLink, isImage, isLinkGrid } from '@welshman/content'

const parsed = parse({ content: event.content, tags: event.tags })

const images = parsed.filter(isImage)
// images[0].value.url  → URL object
// images[0].value.meta → Record<string, string> from imeta tags

const allLinks = parsed.filter(isLink)
```

### Render with a custom link handler (e.g. Svelte/React)

```typescript
import { parse, renderAsHtml } from '@welshman/content'

const html = renderAsHtml(parse({ content }), {
  renderLink: (href, display) =>
    `<a href="${href}" class="text-blue-500 underline" rel="noopener">${display}</a>`,
  renderEntity: (entity) => entity.slice(0, 16) + '…',
}).toString()
```

### Server-side rendering (no DOM)

The default `createElement` calls `document.createElement`, which fails in Node/SSR environments. Override it:

```typescript
import { parse, renderAsHtml } from '@welshman/content'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('')

const html = renderAsHtml(parse({ content }), {
  createElement: (tag: string) => dom.window.document.createElement(tag),
}).toString()
```

### Using custom emoji tags

```typescript
import { parse, isEmoji } from '@welshman/content'

const tags = [
  ['emoji', 'parrot', 'https://example.com/parrot.gif'],
]

const parsed = parse({ content: 'Hello :parrot:!', tags })

const emojiElements = parsed.filter(isEmoji)
// emojiElements[0].value → { name: 'parrot', url: 'https://example.com/parrot.gif' }
```

## Integration Notes

- `@welshman/content` has no dependencies on other welshman packages. It depends on `@braintree/sanitize-url` as a direct dependency and requires `nostr-tools` ^2.x as a peer dependency (consumers must install it).
- Pass `event.content` and `event.tags` to `parse` together so that `imeta`, `emoji` and legacy mention tags are resolved.
- `ParsedLinkValue.meta` is populated from `imeta` tags (NIP-92). When an event carries media metadata, `meta` includes fields like `url`, `m` (MIME type), `blurhash` and `dim`.
- Call `reduceLinks` after `parse` and before `truncate` so that a link grid counts as a single media unit when truncating.

## Gotchas & Tips

- **`parse` trims content** before processing. Leading/trailing whitespace in the raw content string is dropped.
- **`parse` fallback**: if `content` is empty or whitespace, `parse` uses the first `alt` tag value instead.
- **`truncate` returns the original array** if the total estimated size is under `maxLength`.
- **`reduceLinks` requires block-level links**: a link joins a grid only at the start of a block (after a newline or at the very beginning). Inline links in the middle of a sentence stay `ParsedLink`.
- **`isImage` is stricter than `urlIsMedia`**: `isImage` only matches `.jpg/.jpeg/.png/.gif/.webp`, not `.mp4` or `.webm`. `urlIsMedia` detects video too, and takes a URL string rather than a `Parsed` element: `urlIsMedia(parsed.value.url.toString())`.
- **`renderAsHtml` and `renderAsText` return a `Renderer`**, and `Renderer.toString()` gives the string.
- **`LinkGrid` is not rendered by the default renderers**, because `renderOne` has no case for `ParsedType.LinkGrid`. A custom UI renders each `value.links` entry itself, e.g. as an image or card grid. `summarize` names it ("some images").
- **Legacy mentions** (`#[0]`, `#[1]`) are parsed automatically from the `tags` array and emitted as `ParsedProfile` or `ParsedEvent` elements.
- **Numeric hashtags are skipped**: `#42` will not produce a `Topic` element.
- **Any `/trigger` parses as a `Command`**, because the parser does not know which NIP-CD definitions exist, so `/nonsense` is a `Command` too. Match `value.command` (and `value.pubkey`, when the invocation names an executor) against the known definitions, and render the element's `raw` as text when nothing matches. A qualifier that names no valid pubkey leaves the whole invocation as text.
- **Only the start of the content is an invocation**, so `look in /etc/passwd` produces no `Command`.
- **`renderOne` renders `ParsedRoom` as plain text** (`r.addText(p.raw)`) rather than a link, because the renderer does not know a room's display name. A UI handles `isRoom` itself, the same as `isLinkGrid`.
- **Email matching strips a leading `mailto:`**, so `ParsedEmail.value` is always the bare address.
