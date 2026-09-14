---
name: welshman-editor
description: "Use this skill when working with @welshman/editor: the batteries-included Tiptap-based rich-text editor for composing nostr notes with mention autocomplete, media upload, and inline nostr objects."
---

# welshman/editor — Nostr Editor Component

`@welshman/editor` provides a batteries-included text editor for composing nostr notes, built on top of [Tiptap](https://tiptap.dev) and [nostr-editor](https://github.com/cesardeazevedo/nostr-editor). It bundles a curated set of extensions that handle nostr-specific concerns (nprofile mentions, nevent/naddr embeds, file upload, Lightning invoices) as well as general composition features (history, placeholder, inline code, word count). It is framework-agnostic — the core is plain TypeScript/DOM, though it powers the Svelte-based editors of Coracle and Flotilla.

## Installation

```bash
npm install @welshman/editor
# or
pnpm add @welshman/editor
# or
yarn add @welshman/editor
```

Peer dependencies that must be installed separately:

```bash
npm install @welshman/lib @welshman/util nostr-tools nostr-editor
```

Import the bundled CSS to get default object/suggestion styles (optional but recommended):

```typescript
import "@welshman/editor/index.css"
```

---

## Key Exports

### Extensions

| Export | Description |
|--------|-------------|
| `WelshmanExtension` | The main all-in-one Tiptap extension. Configure once; it registers every sub-extension below. `submit` is **required**. |
| `BreakOrSubmit` | Keyboard handler: `Mod-Enter` always submits; `Enter` submits only when `aggressive: true` (chat-style); `Shift-Enter` inserts a hard break. |
| `CodeInline` | Inline `code` node with backtick input/paste rules. |
| `WordCount` | Extension that tracks `editor.storage.wordCount.words` and `editor.storage.wordCount.chars` on every document update. |
| `CommandExtension` | Inline atom node (`name: "command"`) holding a slash-command invocation — `{command, pubkey?}` attributes. `renderText` emits the canonical invocation via `renderCommandInvocation` from `@welshman/util`, so an executor that knows nothing about this client can read it back out of the note. |

### Node Views

These are drop-in Tiptap node-view factory functions that render inline pill elements with `.tiptap-object` CSS class. Override them via `WelshmanExtensionOptions` to render richer UI.

| Export | Renders |
|--------|---------|
| `MentionNodeView` | nprofile nodes — shows `@<bech32 prefix>…` |
| `MediaNodeView` | Image and video nodes — shows filename or URL; adds `.tiptap-uploading` animation while uploading |
| `EventNodeView` | nevent and naddr nodes — shows bech32 prefix |
| `Bolt11NodeView` | bolt11 Lightning invoice nodes — shows the first 16 characters of the Lightning invoice string (the `lnbc` attribute) followed by `...` |

### Plugins

| Export | Description |
|--------|-------------|
| `TippySuggestion` | Generic Tippy.js-powered `@tiptap/suggestion` wrapper. Requires `char`, `name`, `editor`, `search`, and `select`. |
| `MentionSuggestion` | Pre-configured `TippySuggestion` for `@`-triggered nprofile autocomplete. Requires `editor`, `search`, and `getRelays`. |
| `CommandSuggestion` | Pre-configured `TippySuggestion` for `/`-triggered slash commands. Requires `editor`, `search`, and `getAttributes(value) => CommandAttributes \| undefined`. Sets `showOnEmpty: true` (a bare `/` lists what's available) and `allow: ({range}) => range.from === 1` (an invocation is only valid at the very start of the content). |
| `DefaultSuggestionsWrapper` | Default dropdown renderer used by `TippySuggestion`. Implements `ISuggestionsWrapper`; replace to use a framework component. |

**`TippySuggestion` options:**

| Option | Required | Description |
|--------|----------|-------------|
| `char` | yes | Trigger character (e.g. `"@"`, `"~"`) |
| `name` | yes | ProseMirror node type name to insert on selection |
| `editor` | yes | The Tiptap `Editor` instance |
| `search` | yes | `(term: string) => string[]` — returns item values matching the query |
| `select` | yes | `(value: string, props) => void` — called when the user picks an item; call `props.command({...attrs})` to insert the node |
| `updateSignal` | no | A Svelte `Readable` store; when it emits, the suggestion list re-renders (use for async/reactive search results) |
| `allowCreate` | no | Let the user commit the raw term as an item (default `false`) |
| `showOnEmpty` | no | Show the whole list before anything is typed (default `false`). Right for a small closed set the user browses; wrong for profiles, where a bare trigger matches everything |
| `allow` | no | `({state, range}) => boolean` — narrow where the suggestion can fire, on top of the schema check |
| `createSuggestion` | no | `(value: string) => Element` — renders a custom DOM element for each dropdown item |
| `createSuggestionsWrapper` | no | `(target, props) => ISuggestionsWrapper` — swap the dropdown for a framework component |

`MentionSuggestion` is a pre-wired `TippySuggestion` for nprofile nodes. It handles `select` internally (encodes the pubkey as an nprofile with relay hints from `getRelays`) so you only need to supply `editor`, `search`, and `getRelays`.

### Re-exports from upstream

| Export | Source |
|--------|--------|
| `Editor` | `@tiptap/core` — the editor instance class |
| `NodeViewProps` | `@tiptap/core` — prop type for node view factories (Tiptap's type) |
| `UploadTask` | `nostr-editor` — shape of an in-progress or completed file upload |
| `FileAttributes` | `nostr-editor` — `{ file: File, … }` passed to the `upload` callback |
| `editorProps` | `nostr-editor` — base ProseMirror `editorProps` used by nostr-editor; pass directly to `new Editor({ editorProps })` |

---

## WelshmanExtensionOptions Reference

All keys are optional. Pass `false` to disable a built-in extension entirely. Pass `{ extend?, config? }` to override defaults.

```typescript
type WelshmanExtensionOptions = {
  bolt11?:        false
  breakOrSubmit?: false | { extend?, config?: BreakOrSubmitOptions }
  codeInline?:    false | { extend?, config? }
  codeBlock?:     false | { extend?, config?: CodeBlockOptions }
  document?:      false
  dropcursor?:    false | { extend?, config?: DropcursorOptions }
  fileUpload?:    { extend?: Partial<any>, config?: Partial<FileUploadOptions> & Pick<FileUploadOptions, "upload"> }
  gapcursor?:     false
  history?:       false | { extend?, config?: HistoryOptions }
  image?:         false | { extend?, config?: ImageOptions }
  link?:          false | { extend?, config?: LinkOptions }
  naddr?:         false | { extend?, config? }
  nevent?:        false | { extend?, config? }
  nprofile?:      false | { extend?, config? }
  nsecReject?:    false | { extend?, config?: NSecRejectOptions }
  paragraph?:     false | { extend?, config?: ParagraphOptions }
  placeholder?:   false | { extend?, config?: PlaceholderOptions }
  tag?:           false
  text?:          false
  video?:         false
  wordCount?:     false
}
```

`fileUpload.config` requires at minimum an `upload` function. The `upload` callback must return `Promise<UploadTask>`:

```typescript
interface UploadResult { url: string; sha256: string; tags: string[][] }
interface UploadTask   { result?: UploadResult; error?: string }
```

Default allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/mpeg`, `video/webm`. `immediateUpload` defaults to `true`.

---

## Example

A full-featured editor factory covering file upload, @-mention and custom-trigger autocomplete, reactive node views, word count, and draft persistence.

```typescript
import {get, writable} from "svelte/store"
import {Node, Extension, mergeAttributes} from "@tiptap/core"
import {Plugin, PluginKey} from "@tiptap/pm/state"
import type {NodeViewRendererProps} from "@tiptap/core"
import {Profiles, Router} from "@welshman/app"
import {outbox} from "@welshman/util"
import {
  Editor, WelshmanExtension, MentionSuggestion, TippySuggestion, editorProps,
} from "@welshman/editor"
import type {FileAttributes, UploadTask} from "@welshman/editor"

// ── Custom inline node: room reference (~) ───────────────────────────────────
// Defines a new ProseMirror node type for inline room references.
// Register it alongside WelshmanExtension so Tiptap knows about the "roomref" name.

const RoomReferenceExtension = Node.create({
  name: "roomref",
  atom: true, inline: true, group: "inline", selectable: true, priority: 1000,
  addAttributes: () => ({url: {default: undefined}, h: {default: undefined}}),
  parseHTML:  () => [{tag: 'span[data-type="roomref"]'}],
  renderHTML: ({HTMLAttributes}) =>
    ["span", mergeAttributes(HTMLAttributes, {"data-type": "roomref"}), "~"],
  renderText: ({node}) => `~${node.attrs.url ?? ""}:${node.attrs.h ?? ""}`,
  addNodeView: () => ({node}: NodeViewRendererProps) => {
    const dom = document.createElement("span")
    dom.classList.add("room-ref")
    const unsub = deriveRoomDisplay(node.attrs.url, node.attrs.h)
      .subscribe(d => { dom.textContent = "~" + d })
    return {
      dom, destroy: unsub,
      selectNode:   () => dom.classList.add("room-ref--active"),
      deselectNode: () => dom.classList.remove("room-ref--active"),
    }
  },
})

// ── Editor factory ────────────────────────────────────────────────────────────

export const makeEditor = ({
  content = "" as string | object,
  placeholder = "",
  uploading,   // optional Writable<boolean>
  wordCount,   // optional Writable<number>
  charCount,   // optional Writable<number>
  submit,
}: {
  content?: string | object
  placeholder?: string
  uploading?: ReturnType<typeof writable<boolean>>
  wordCount?: ReturnType<typeof writable<number>>
  charCount?: ReturnType<typeof writable<number>>
  submit: () => void
}) => {
  // The Profiles plugin maintains a ready-made fuzzy search over known profiles
  const profileSearch = get(app.use(Profiles).profileSearch)

  const editor = new Editor({
    content,
    editorProps,
    element: document.createElement("div"),
    extensions: [
      RoomReferenceExtension,
      WelshmanExtension.configure({
        submit,
        extensions: {
          // Chat-style: Enter submits, Shift-Enter inserts line break
          breakOrSubmit: {config: {aggressive: true}},
          placeholder: {config: {placeholder}},

          // File upload — upload() must return Promise<UploadTask>
          fileUpload: {
            config: {
              upload: async (attrs: FileAttributes): Promise<UploadTask> => {
                try {
                  const {url, sha256, tags} = await myUploadServer(attrs.file)
                  return {result: {url, sha256, tags}}
                } catch (e) {
                  return {error: String(e)}
                }
              },
              onDrop:        () => uploading?.set(true),
              onComplete:    () => uploading?.set(false),
              onUploadError: (ed, _task) => {
                ed.commands.removeFailedUploads()
                uploading?.set(false)
              },
            },
          },

          // Custom reactive nprofile node view + "@" and "~" autocomplete
          nprofile: {
            extend: {
              addNodeView: () => ({node}: NodeViewRendererProps) => {
                const dom = document.createElement("span")
                dom.classList.add("mention")
                const unsub = app.use(Profiles).display(node.attrs.pubkey).$
                  .subscribe($d => { dom.textContent = "@" + $d })
                return {
                  dom, destroy: unsub,
                  selectNode:   () => dom.classList.add("mention--active"),
                  deselectNode: () => dom.classList.remove("mention--active"),
                }
              },
              addProseMirrorPlugins() {
                return [
                  // "@" — nprofile mention; updateSignal re-renders when search index changes
                  MentionSuggestion({
                    editor: (this as any).editor,
                    search: term => profileSearch.searchValues(term),
                    getRelays: async pubkey =>
                      (await app.use(Router).resolve([outbox(pubkey)])).getUrls(),
                    createSuggestion: pubkey => {
                      const el = document.createElement("span")
                      el.textContent = pubkey.slice(0, 12) + "…"
                      return el
                    },
                  }),
                  // "~" — custom roomref node; select must call props.command({...attrs})
                  TippySuggestion({
                    char: "~", name: "roomref",
                    editor: (this as any).editor,
                    search: term => roomSearch.searchValues(term),
                    select: (id, props) => {
                      const [url, h] = splitRoomId(id)
                      if (url && h) props.command({url, h})
                    },
                    createSuggestion: id => {
                      const el = document.createElement("span")
                      el.textContent = id.slice(0, 16) + "…"
                      return el
                    },
                  }),
                ]
              },
            },
          },
        },
      }),
    ],
    onUpdate({editor}) {
      wordCount?.set(editor.storage.wordCount.words)
      charCount?.set(editor.storage.wordCount.chars)
    },
  })

  return editor
}

// ── Reading content on submit ─────────────────────────────────────────────────

const onSubmit = (editor: Editor) => {
  const content = editor.getText({blockSeparator: "\n"}).trim()
  const tags    = editor.storage.nostr.getEditorTags()  // NIP-10 / NIP-27 tags
  console.log({content, tags})
  editor.chain().clearContent().run()
}

// ── Mounting in Svelte ────────────────────────────────────────────────────────
```

```svelte
<script lang="ts">
  import type {Editor} from "@welshman/editor"
  import {onMount, onDestroy} from "svelte"

  const {editor, autofocus = false}: {editor: Editor; autofocus?: boolean} = $props()

  let element: HTMLElement

  onMount(() => {
    element.append(editor.options.element)
    if (autofocus) {
      const atEnd = editor.getText().trim().length > 0
      requestAnimationFrame(() => editor.commands.focus(atEnd ? "end" : "start"))
    }
  })

  onDestroy(() => editor.destroy())
</script>

<div bind:this={element}></div>
```

---

## Integration Notes

- **`@welshman/app`** — `app.use(Profiles).profileSearch` and `app.use(Profiles).display(pubkey)` are the typical sources for mention autocomplete data and display names.
- **`@welshman/app`** — `app.use(Router).resolve([outbox(pubkey)])` provides the relay hints encoded into nprofile bech32 strings.
- **`@welshman/util`** — `fromNostrURI` is used internally by `EventNodeView` to strip the `nostr:` scheme before displaying.
- **`nostr-editor`** — `WelshmanExtension` extends `NostrExtension` from this package. Storage at `editor.storage.nostr` (including `getEditorTags()`) is provided by `nostr-editor`, not welshman itself.
- **`@tiptap/core`** — `Editor`, `NodeViewProps`, and all extension primitives come from Tiptap. Welshman does not re-export every Tiptap helper; import additional ones directly from `@tiptap/core` as needed.

---

## Gotchas & Tips

- **`submit` is required.** `WelshmanExtension.configure({submit})` will throw during editor initialization (when extensions are registered) if `submit` is omitted, not at the `configure()` call site.
- **Extension options are deep-merged, not replaced.** User-supplied `extensions` options are merged with welshman defaults via `deepMergeLeft`, so you only need to specify the keys you want to change. Supplying `false` for a key fully disables that extension.
- **Default node views are plain DOM.** The built-in `MentionNodeView`, `MediaNodeView`, etc. render minimal pill text. Override them via the `extend.addNodeView` pattern (see pattern 4) to render framework components, avatars, or rich previews.
- **`selectFiles()` command.** To open a file picker without a UI button inside the editor, call `editor.chain().selectFiles().run()` from any external button click handler.
- **CSS variables.** The bundled `index.css` exposes `--tiptap-object-bg`, `--tiptap-object-fg`, `--tiptap-active-bg`, `--tiptap-active-fg` for theming pills and the suggestion dropdown without overriding classes.
- **`tiptap-uploading` animation.** While a file is being uploaded, `MediaNodeView` adds the `.tiptap-uploading` class which triggers a pulsing opacity animation defined in `index.css`. No manual wiring is needed.
- **Tippy appends to dialog when open.** `TippySuggestion` checks for an open `<dialog>` element and appends the suggestion popover inside it to avoid z-index stacking issues in modal composers.
- **`getEditorTags()` returns NIP-10/27 tags.** This method on `editor.storage.nostr` collects all inline nostr objects (mentions, links, embeds) and returns the appropriate `p`, `e`, `a`, `t`, `r` tags for the published event. Always call this when building the event to publish.
- **Initial content.** Pass either a plain string or a ProseMirror JSON object to `new Editor({content})`. To restore a draft, save `editor.getJSON()` and pass it back as `content`.
- **`removeFailedUploads()` command.** Call `editor.commands.removeFailedUploads()` in `onUploadError` to clean up any partially-inserted upload nodes so the composer stays in a clean state.
- **`addFile(file, pos)` command.** Programmatically inserts a file upload node at a given ProseMirror position — useful for native clipboard paste (e.g. mobile) where the browser paste event carries no file data.
- **`editor.commands.focus('start' | 'end' | number)`.** Pass `"end"` to place the cursor after existing content (restoring a draft), `"start"` for a fresh empty editor. Call inside `requestAnimationFrame` when the editor element was just mounted.
