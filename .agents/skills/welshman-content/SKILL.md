---
name: welshman-content
description: "Use this skill when working with @welshman/content: parsing nostr note content, extracting mentions/links/media/topics, or rendering parsed content to HTML or custom formats."
---

# welshman/content — Note Content Parsing

`@welshman/content` parses raw nostr event content strings into structured typed elements (links, profiles, events, topics, media, etc.) and renders them back to text or HTML. It is a standalone package with no welshman sibling dependencies — it sits at the bottom of the stack and can be used independently or alongside `@welshman/app`, `@welshman/net`, etc.

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
| `reduceLinks(content)` | Collapses consecutive block-level links (each on its own line) into a single `LinkGrid` element for gallery rendering. |
| `urlIsMedia(url)` | Returns `true` if the URL has a media file extension (jpg, png, gif, webp, mp4, etc.). |

### Parsed Types

`ParsedType` enum values and their corresponding type shapes:

| `ParsedType` | `value` type | Notes |
|---|---|---|
| `Text` | `string` | Plain text |
| `Newline` | `string` | One or more `\n` characters |
| `Topic` | `string` | Hashtag text without the `#`; numeric-only tags are skipped |
| `Command` | `{ command: string, pubkey?: string }` | A NIP-CD invocation (`/kick`, `/kick@npub1…`), only ever at the start of the content; `pubkey` is the executor the qualifier names |
| `Link` | `{ url: URL, meta: Record<string, string> }` | URLs with any scheme (http, https, ftp, ws, wss, etc.) and bare domains without a protocol; `meta` is populated from `imeta` tags or URL hash params |
| `LinkGrid` | `{ links: ParsedLinkValue[] }` | Produced by `reduceLinks`; a collection of adjacent block links |
| `Profile` | `ProfilePointer` (`{ pubkey, relays? }`) | nostr:npub / nostr:nprofile / @nostr:npub / @nostr:nprofile references (the `nostr:` prefix is required) |
| `Event` | `EventPointer` (`{ id, relays?, author?, kind? }`) | note / nevent references |
| `Address` | `AddressPointer` (`{ identifier, pubkey, kind, relays? }`) | naddr references |
| `Emoji` | `{ name: string, url?: string }` | `:shortcode:` — `url` resolved from `emoji` tags |
| `Room` | `ParsedRoomValue` (`{ url, room }`) | A NIP-29 room reference written as `relay.example.com'roomid` (an apostrophe or `’` between host and room id). The url is normalized to include a protocol and trailing slash; possessives like `example.com's` are skipped |
| `Code` | `string` | Backtick inline code or triple-backtick blocks |
| `Cashu` | `string` | cashu: token strings |
| `Invoice` | `string` | Bare lightning invoice string (without `lightning:` prefix); the `lightning:` prefix is in `raw` |
| `Email` | `string` | Email addresses (with or without `mailto:`) |
| `Ellipsis` | `string` | Appended by `truncate` to indicate truncated content |

Every `Parsed` element also has a `raw: string` field holding the original matched text (empty string for synthetic elements like `LinkGrid` and `Ellipsis`).

### Type Guards

All guards narrow the union type:

```
isAddress  isCashu    isCode     isCommand  isEllipsis
isEmail    isEmoji    isEvent    isImage    isInvoice
isLink     isLinkGrid isNewline  isProfile  isRoom
isText     isTopic
```

`isImage(parsed)` — special guard: true only for `ParsedLink` elements whose URL ends in `.jpg/.jpeg/.png/.gif/.webp`.

### Rendering

| Export | Description |
|--------|-------------|
| `renderAsText(parsed, options?)` | Renders `Parsed \| Parsed[]` to a `Renderer`; call `.toString()` to get a string. Text rendering shows links as full raw URLs and entities as their full bech32 string (the `renderEntity` truncation is discarded in text mode since `renderLink` returns the href). |
| `renderAsHtml(parsed, options?)` | Same, but produces sanitized HTML with `<a>` tags. Default `entityBase` is `https://njump.me/`. |
| `render(parsed, renderer)` | Low-level: renders into an existing `Renderer` instance. |
| `makeTextRenderer(options?)` | Creates a `Renderer` pre-configured for text output. |
| `makeHtmlRenderer(options?)` | Creates a `Renderer` pre-configured for HTML output. |
| `Renderer` | Class with `addText`, `addLink`, `addEntityLink`, `addNewlines`, `toString`. |

`RenderOptions` fields (all optional when using the convenience functions):

| Field | Default (HTML) | Description |
|---|---|---|
| `newline` | `"\n"` | String emitted for each newline character |
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
// → 'Hello nostr! Check out <a href="https://njump.me/nprofile1..." target="_blank">nprofile1qqsj…</a>'
```

### Truncate long notes for a feed preview

```typescript
import { parse, truncate, reduceLinks, renderAsHtml } from '@welshman/content'

const parsed = parse({ content: event.content, tags: event.tags })
const withGrids = reduceLinks(parsed)
const preview = truncate(withGrids, { minLength: 300, maxLength: 500 })
const html = renderAsHtml(preview).toString()
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
- In `@welshman/app`, content parsing is typically done at the component layer. The `parse` function is called with `event.content` and `event.tags` together so that `imeta` and `emoji` tags are resolved.
- `ParsedLinkValue.meta` is populated from `imeta` tags (NIP-92). When an event carries rich media metadata, the parsed link's `meta` object will include fields like `url`, `m` (MIME type), `blurhash`, `dim`, etc.
- `reduceLinks` should be called after `parse` and before `truncate` if you want link grids to count as single media units for truncation purposes.

## Gotchas & Tips

- **`parse` trims content** before processing. Leading/trailing whitespace in the raw content string is dropped.
- **`parse` fallback**: if `content` is empty or whitespace, `parse` will use the first `alt` tag value instead. This is useful for kind-1 reposts and other events with alternative text.
- **`truncate` is non-destructive** when content is short: it returns the original array unchanged if the total estimated size is under `maxLength`.
- **`reduceLinks` requires block-level links**: a link is only pulled into a grid if it appears at the start of a block (i.e. preceded by a newline or at the very beginning). Inline links in the middle of a sentence are left as `ParsedLink`.
- **`isImage` is stricter than `urlIsMedia`**: `isImage` only matches `.jpg/.jpeg/.png/.gif/.webp` — it will not match `.mp4` or `.webm`. Use `urlIsMedia` directly if you need to detect video; note that `urlIsMedia` takes a URL string, not a `Parsed` element — usage would be: `urlIsMedia(parsed.value.url.toString())`.
- **`Renderer.toString()`** is how you get the final string out. `renderAsHtml` and `renderAsText` both return a `Renderer` instance, not a string.
- **`LinkGrid` is not rendered by default renderers**: `renderOne` has no case for `ParsedType.LinkGrid`. You must handle it yourself when building a custom UI (e.g. render each `value.links` entry as an image or card grid).
- **Legacy mentions** (`#[0]`, `#[1]`) are parsed automatically from the `tags` array and emitted as `ParsedProfile` or `ParsedEvent` elements.
- **Numeric hashtags are skipped**: `#42` will not produce a `Topic` element.
- **A `Command` is syntax, not a promise that anyone answers to it**: the parser has no idea which NIP-CD definitions exist, so `/nonsense` parses as a `Command` too. Match `value.command` (and `value.pubkey`, when the invocation names an executor) against the definitions you have, and render the element's `raw` as text when nothing matches.
- **Only the start of the content is an invocation**: a slash later in the text is punctuation or part of a path, so `look in /etc/passwd` produces no `Command`.
- **`ParsedRoom` is emitted by `renderOne` as plain text** (`r.addText(p.raw)`) rather than a link, because the renderer has no way to know a room's display name. Handle `isRoom` yourself when building a UI, the same as `isLinkGrid`.
- **Email matching** strips a leading `mailto:` — the resulting `ParsedEmail.value` is always the bare address string.
