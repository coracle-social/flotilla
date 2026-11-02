---
name: welshman-editor
description: "Use this skill when working with @welshman/editor: the batteries-included Tiptap-based rich-text editor for composing nostr notes with mention autocomplete, media upload, and inline nostr objects."
---

# welshman/editor — Nostr Editor Component

`@welshman/editor` is a text editor for composing nostr notes, built on [Tiptap](https://tiptap.dev) and [nostr-editor](https://github.com/cesardeazevedo/nostr-editor). It bundles extensions for nprofile mentions, nevent/naddr embeds, file upload and Lightning invoices, along with history, a placeholder, inline code and a word count. The package is plain TypeScript and DOM, and powers the Svelte editors of Coracle and Flotilla.

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
npm install @welshman/lib @welshman/util nostr-tools nostr-editor \
  @tiptap/core @tiptap/pm @tiptap/suggestion @tiptap/extension-code @tiptap/extension-code-block \
  @tiptap/extension-document @tiptap/extension-dropcursor @tiptap/extension-gapcursor \
  @tiptap/extension-hard-break @tiptap/extension-history @tiptap/extension-paragraph \
  @tiptap/extension-placeholder @tiptap/extension-text
```

The bundled CSS provides default object and suggestion styles:

```typescript
import "@welshman/editor/index.css"
```

---

## Key Exports

### Extensions

| Export | Description |
|--------|-------------|
| `WelshmanExtension` | The main Tiptap extension. It registers `BreakOrSubmit`, `CodeInline` and `WordCount` along with the Tiptap and nostr-editor extensions listed under `WelshmanExtensionOptions`. `submit` is **required**. |
| `BreakOrSubmit` | Keyboard handler: `Mod-Enter` always submits; `Enter` submits only when `aggressive: true` (chat-style); `Shift-Enter` inserts a hard break. |
| `CodeInline` | Inline `code` node with backtick input/paste rules. |
| `WordCount` | Extension that tracks `editor.storage.wordCount.words` and `editor.storage.wordCount.chars` on every document update. |
| `CommandExtension` | Inline atom node (`name: "command"`) holding a slash-command invocation with `{command, pubkey?}` attributes. `renderText` emits the canonical invocation via `renderCommandInvocation` from `@welshman/util`. `WelshmanExtension` does not register it, so add it to `extensions` alongside `CommandSuggestion`. |

### Node Views

These Tiptap node-view factories render inline pills with the `.tiptap-object` CSS class. Override them via `WelshmanExtensionOptions` to render richer UI.

| Export | Renders |
|--------|---------|
| `MentionNodeView` | nprofile nodes, as `@` and the first 16 characters of the bech32 followed by `...` |
| `MediaNodeView` | Image and video nodes, as the filename or URL; adds the `.tiptap-uploading` class while uploading |
| `EventNodeView` | nevent and naddr nodes, as the first 16 characters of the bech32 followed by `...` |
| `Bolt11NodeView` | bolt11 Lightning invoice nodes, as the first 16 characters of the invoice (the `lnbc` attribute) followed by `...` |

### Plugins

| Export | Description |
|--------|-------------|
| `TippySuggestion` | Generic Tippy.js-powered `@tiptap/suggestion` wrapper. Requires `char`, `name`, `editor`, `search`, and `select`. |
| `MentionSuggestion` | Pre-configured `TippySuggestion` for `@`-triggered nprofile autocomplete. Requires `editor`, `search`, and a synchronous `getRelays(pubkey) => string[]`. |
| `CommandSuggestion` | Pre-configured `TippySuggestion` for `/`-triggered slash commands. Requires `editor`, `search`, and `getAttributes(value) => CommandAttributes \| undefined`. Sets `showOnEmpty: true`, so a bare `/` lists what's available, and `allow: ({range}) => range.from === 1`, because an invocation is only valid at the very start of the content. |
| `DefaultSuggestionsWrapper` | Default dropdown renderer used by `TippySuggestion`. It shows the first 5 results of `search`, throttled to 300 ms. Implements `ISuggestionsWrapper`; replace it to use a framework component. |

**`TippySuggestion` options:**

| Option | Required | Description |
|--------|----------|-------------|
| `char` | yes | Trigger character (e.g. `"@"`, `"~"`) |
| `name` | yes | ProseMirror node type name to insert on selection |
| `editor` | yes | The Tiptap `Editor` instance |
| `search` | yes | `(term: string) => string[]` — returns item values matching the query |
| `select` | yes | `(value: string, props) => void` — called when the user picks an item; call `props.command({...attrs})` to insert the node |
| `updateSignal` | no | Anything with a store-style `subscribe`; when it emits, the suggestion list re-runs `search` (for async or reactive search results) |
| `allowCreate` | no | Let the user commit the raw term as an item (default `false`) |
| `showOnEmpty` | no | Show the list before anything is typed (default `false`). It suits a small closed set the user browses, and not profiles, where a bare trigger matches everything |
| `allow` | no | `({state, range}) => boolean` — narrow where the suggestion can fire, on top of the schema check |
| `createSuggestion` | no | `(value: string) => Element` — renders a custom DOM element for each dropdown item |
| `createSuggestionsWrapper` | no | `(target, props) => ISuggestionsWrapper` — swap the dropdown for a framework component |

`MentionSuggestion` handles `select` itself by encoding the pubkey as an nprofile with relay hints from `getRelays`.

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
import {Profiles, RelayLists} from "@welshman/app"
import {
  Editor, WelshmanExtension, MentionSuggestion, TippySuggestion, editorProps,
} from "@welshman/editor"
import type {FileAttributes, UploadTask} from "@welshman/editor"

// ── Custom inline node: room reference (~) ───────────────────────────────────
// Registered alongside WelshmanExtension so Tiptap knows the "roomref" node type

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
                  // "@" — nprofile mention; getRelays must be synchronous
                  MentionSuggestion({
                    editor: (this as any).editor,
                    search: term => profileSearch.searchValues(term),
                    getRelays: pubkey => app.use(RelayLists).get(pubkey)?.writeUrls() ?? [],
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

- **`@welshman/app`**: `app.use(Profiles).profileSearch` and `app.use(Profiles).display(pubkey)` supply mention autocomplete and display names. `app.use(RelayLists).get(pubkey)?.writeUrls()` supplies the relay hints encoded into nprofiles, synchronously from the cache.
- **`@welshman/util`**: `EventNodeView` uses `fromNostrURI` to strip the `nostr:` scheme before displaying.
- **`nostr-editor`**: `WelshmanExtension` extends its `NostrExtension`, which provides `editor.storage.nostr` (including `getEditorTags()`).
- **`@tiptap/core`**: `Editor`, `NodeViewProps`, and all extension primitives come from Tiptap. Welshman re-exports only `Editor` and `NodeViewProps`; import other helpers from `@tiptap/core` directly.

---

## Gotchas & Tips

- **`submit` is required.** Without it, `WelshmanExtension` throws when the editor registers its extensions, not at the `configure()` call.
- **Extension options are deep-merged.** `extensions` options are merged with the welshman defaults via `deepMergeLeft`, so only the keys being changed are needed. `false` disables that extension.
- **Default node views are plain DOM.** The built-in `MentionNodeView`, `MediaNodeView`, etc. render minimal pill text. Override them with `extend.addNodeView` (see the Example) to render framework components, avatars, or rich previews.
- **`selectFiles()` command.** `editor.chain().selectFiles().run()` opens a file picker from any external button.
- **CSS variables.** The bundled `index.css` exposes `--tiptap-object-bg`, `--tiptap-object-fg`, `--tiptap-active-bg`, `--tiptap-active-fg` for theming pills and the suggestion dropdown without overriding classes.
- **`tiptap-uploading` animation.** While a file uploads, `MediaNodeView` adds the `.tiptap-uploading` class, which `index.css` animates with a pulsing opacity.
- **Tippy appends to an open dialog.** `TippySuggestion` appends the suggestion popover inside an open `<dialog>` element if there is one, so it stacks above modal composers.
- **`getEditorTags()` returns NIP-10/27 tags.** This method on `editor.storage.nostr` collects the inline nostr objects (mentions, links, embeds) and returns the `p`, `e`, `a`, `t`, `r` tags for the published event.
- **Initial content.** Pass either a plain string or a ProseMirror JSON object to `new Editor({content})`. To restore a draft, save `editor.getJSON()` and pass it back as `content`.
- **`removeFailedUploads()` command.** Call `editor.commands.removeFailedUploads()` in `onUploadError` to remove partially inserted upload nodes.
- **`addFile(file, pos)` command.** Inserts a file upload node at a ProseMirror position, e.g. for native clipboard paste on mobile, where the browser paste event carries no file data.
- **Destroy the editor when its DOM goes away.** `editor.destroy()` removes the view's document-level `selectionchange` listener and makes any pending mutation flush a no-op.
- **`editor.commands.focus('start' | 'end' | number)`.** Pass `"end"` to place the cursor after existing content (restoring a draft), `"start"` for a fresh empty editor. Call inside `requestAnimationFrame` when the editor element was just mounted.
