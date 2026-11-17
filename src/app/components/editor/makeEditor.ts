import {mount} from "svelte"
import type {Writable} from "svelte/store"
import {get, derived} from "svelte/store"
import {sortBy, uniq} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {Profiles, RelayMemberLists, Rooms, createSearch, splitRoomKey} from "@welshman/app"
import type {Room} from "@welshman/app"
import type {FileAttributes} from "@welshman/editor"
import {
  CommandExtension,
  CommandSuggestion,
  Editor,
  MentionSuggestion,
  TippySuggestion,
  WelshmanExtension,
  editorProps,
} from "@welshman/editor"
import type {CommandScopeTarget} from "@welshman/util"
import type {EditorView} from "@tiptap/pm/view"
import {nprofileEncode} from "nostr-tools/nip19"
import {escapeHtml} from "@lib/html"
import {fromApp} from "@app/core/app"
import {profiles, relayLists} from "@app/core/plugins"
import {
  commands,
  createCommandSearch,
  getCommandByAddress,
  getCommandsForTarget,
} from "@app/features/spaces/rooms/commands"
import {CommandNodeView} from "@app/components/editor/CommandNodeView"
import CommandSuggestionItem from "@app/components/editor/CommandSuggestion.svelte"
import {MentionNodeView} from "@app/components/editor/MentionNodeView"
import ProfileSuggestion from "@app/components/editor/ProfileSuggestion.svelte"
import {RoomReferenceExtension} from "@app/components/editor/RoomReferenceExtension"
import RoomSuggestion from "@app/components/editor/RoomSuggestion.svelte"
import {NativeClipboardPasteExtension} from "@app/components/editor/clipboard"
import {compressFileForUpload, makeImetaTag, uploadFile} from "@app/tools/uploads"
import {activeSpaceUrls} from "@app/core/user"
import {pushToast} from "@app/navigation/toast"

const isEmpty = (editor: Editor) => editor.getText({blockSeparator: "\n"}).trim() === ""

export const makeEditor = async ({
  encryptFiles = false,
  aggressive = false,
  charCount,
  content = "",
  empty,
  onChange,
  placeholder = "",
  url,
  submit,
  text,
  uploading,
  wordCount,
  commandTarget,
}: {
  encryptFiles?: boolean
  aggressive?: boolean
  charCount?: Writable<number>
  content?: string | object
  empty?: Writable<boolean>
  onChange?: (json: object) => void
  placeholder?: string
  url?: string
  submit: () => void
  text?: Writable<string>
  uploading?: Writable<boolean>
  wordCount?: Writable<number>
  // When given, `/` at the start of the composer suggests commands scoped to this target
  commandTarget?: CommandScopeTarget
}) => {
  const searchProfiles = derived(
    [
      fromApp($app => $app.use(Profiles).profileSearch),
      throttled(
        800,
        fromApp($app => $app.use(RelayMemberLists).forUrl(url ?? "")),
      ),
    ],
    ([$profileSearch, $spaceMembers]) => {
      const memberPubkeys = new Set($spaceMembers?.pubkeys())

      return (term: string) =>
        sortBy(pubkey => (memberPubkeys.has(pubkey) ? 0 : 1), $profileSearch.searchValues(term))
    },
  )

  const roomReferenceSearch = derived(
    [
      throttled(800, activeSpaceUrls),
      throttled(
        800,
        fromApp($app => $app.use(Rooms).byUrl.$),
      ),
    ],
    ([$activeSpaceUrls, $roomsByUrl]) => {
      const spaceUrls = uniq(url ? [url, ...$activeSpaceUrls] : $activeSpaceUrls)

      const options = spaceUrls.flatMap(spaceUrl =>
        ($roomsByUrl.get(spaceUrl) ?? []).map((room: Room) => ({
          id: room.id,
          h: room.h,
          name: room.meta?.name() ?? "",
        })),
      )

      return createSearch(options, {
        getValue: option => option.id,
        fuseOptions: {
          keys: ["name", "h"],
          threshold: 0.3,
          shouldSort: false,
        },
      })
    },
  )

  if (commandTarget?.url) {
    commands.get().ensureLoaded(commandTarget.url)
  }

  const commandSearch = derived(throttled(800, commands.get().index.$), () =>
    commandTarget ? createCommandSearch(commandTarget) : undefined,
  )

  // The spec prefers a bare trigger, so qualify only where one would reach more than one executor.
  const getCommandAttributes = (address: string) => {
    if (commandTarget) {
      const command = getCommandByAddress(commandTarget.url ?? "", address)

      if (command) {
        const trigger = command.command() ?? ""
        const matches = getCommandsForTarget(commandTarget).filter(
          option => option.command() === trigger,
        )

        return {command: trigger, pubkey: matches.length > 1 ? command.author() : undefined}
      }
    }
  }

  // A file the editor has no node for is uploaded here, so it holds `uploading` open itself.
  const attachments: {url: string; tag: string[]}[] = []

  let attaching = 0

  const setUploading = () =>
    uploading?.set(
      attaching > 0 ||
        ed.storage.fileUpload.uploader.getFiles().some((attrs: FileAttributes) => attrs.uploading),
    )

  const attachFile = async (editor: Editor, file: File) => {
    attaching += 1
    uploading?.set(true)

    const {error, result} = await uploadFile(file, {url, encrypt: encryptFiles})

    attaching -= 1
    setUploading()

    if (result) {
      attachments.push({url: result.url, tag: makeImetaTag(file, result)})
      editor
        .chain()
        .focus()
        .insertContent({type: "text", text: result.url + " "})
        .run()
    } else {
      pushToast({theme: "error", message: error})
    }
  }

  const getProfileNames = (pubkey: string) => {
    const profile = profiles.get().get(pubkey)

    if (profile) {
      const nip05 = profile.nip05() ?? ""

      return [profile.display(), nip05, nip05.split("@")[0]]
        .filter(name => name)
        .map(name => name.toLowerCase())
    }

    return []
  }

  // A name links only when it is the whole name or handle of exactly one person.
  const findMentionedPubkey = (term: string) => {
    const name = term.toLowerCase()
    const pubkeys = uniq(
      get(searchProfiles)(term).filter(pubkey => getProfileNames(pubkey).includes(name)),
    )

    if (pubkeys.length === 1) {
      return pubkeys[0]
    }
  }

  // Dictation, pasting and phone keyboards never open the suggestion list, so link what they leave.
  const resolveMentions = (view: EditorView) => {
    const mentions: {from: number; to: number; pubkey: string}[] = []

    view.state.doc.descendants((node, pos, parent) => {
      const isCode =
        parent?.type.name === "codeBlock" || node.marks.some(mark => mark.type.name === "code")

      if (node.isText && !isCode) {
        for (const match of (node.text ?? "").matchAll(/(?:^|\s)@([\p{L}\p{N}_.-]+)/gu)) {
          const term = match[1]
          const from = pos + match.index + match[0].length - term.length - 1
          const pubkey = findMentionedPubkey(term)

          if (pubkey) {
            mentions.push({from, to: from + term.length + 1, pubkey})
          }
        }
      }
    })

    if (mentions.length > 0) {
      const tr = view.state.tr

      // Backwards, so a replacement never moves a range this still has to visit.
      for (const {from, to, pubkey} of mentions.reverse()) {
        const relays = relayLists.get().writeUrls(pubkey).get()
        const bech32 = nprofileEncode({pubkey, relays})
        const attrs = {type: "nprofile", bech32, pubkey, relays}

        tr.replaceWith(from, to, tr.doc.type.schema.nodes.nprofile.create(attrs))
      }

      view.dispatch(tr)
    }
  }

  const ed = new Editor({
    content: typeof content === "string" ? undefined : content,
    editorProps: {
      ...editorProps,
      // Enter sends in a chat composer and leaves no blur behind it, so link before it does.
      handleKeyDown: (view, event) => {
        if (event.key === "Enter" && !event.isComposing) {
          resolveMentions(view)
        }

        return false
      },
    },
    element: document.createElement("div"),
    extensions: [
      RoomReferenceExtension,
      CommandExtension.extend({addNodeView: () => CommandNodeView}),
      WelshmanExtension.configure({
        submit,
        extensions: {
          placeholder: {
            config: {
              placeholder,
            },
          },
          breakOrSubmit: {
            config: {
              aggressive,
            },
          },
          fileUpload: {
            config: {
              // nostr-editor reads this as the picker's `accept` and as an exact match against the file's type.
              allowedMimeTypes: Object.assign(["*/*"], {includes: () => true}),
              // A rejection here never reaches onUploadError, so the node would keep `uploading`.
              upload: async (attrs: FileAttributes) => {
                try {
                  const file = await compressFileForUpload(attrs.file)

                  return await uploadFile(file, {url, encrypt: encryptFiles})
                } catch (e) {
                  return {error: String(e)}
                }
              },
              onDrop: () => uploading?.set(true),
              onComplete: () => setUploading(),
              onUploadError(currentEditor, task) {
                currentEditor.commands.removeFailedUploads()
                pushToast({theme: "error", message: task.error})
                setUploading()
              },
            },
            extend: {
              // addFile only knows how to make an image or a video node, so everything else uploads on its own.
              onCreate() {
                const {uploader} = this.storage
                const addFile = uploader.addFile.bind(uploader)

                uploader.addFile = (file: File, pos: number) => {
                  if (file.type.match(/^(image|video)\//)) {
                    return addFile(file, pos)
                  }

                  attachFile(this.editor, file)

                  return true
                }

                // Paste filters by mime type before it ever reaches addFile.
                uploader.handlePaste = (event: ClipboardEvent) => {
                  const files = Array.from(event.clipboardData?.items || [])
                    .filter(item => item.kind === "file")
                    .map(item => item.getAsFile())
                    .filter(Boolean) as File[]

                  for (const file of files) {
                    uploader.addFile(file, uploader.view.state.selection.from + 1)
                  }

                  return files.length > 0
                }
              },
            },
          },
          nprofile: {
            extend: {
              addNodeView: () => MentionNodeView,
              addProseMirrorPlugins() {
                return [
                  MentionSuggestion({
                    editor: this.editor,
                    search: (term: string) => get(searchProfiles)(term),
                    getRelays: (pubkey: string) => relayLists.get().writeUrls(pubkey).get(),
                    updateSignal: searchProfiles,
                    createSuggestion: (value: string) => {
                      const target = document.createElement("div")

                      mount(ProfileSuggestion, {target, props: {value}})

                      return target
                    },
                  }),
                  TippySuggestion({
                    char: "~",
                    name: "roomref",
                    editor: this.editor,
                    search: (term: string) => get(roomReferenceSearch).searchValues(term),
                    updateSignal: roomReferenceSearch,
                    select: (id: string, props) => {
                      const [roomUrl, h] = splitRoomKey(id)

                      if (roomUrl && h) {
                        return props.command({url: roomUrl, h})
                      }
                    },
                    createSuggestion: (value: string) => {
                      const target = document.createElement("div")

                      mount(RoomSuggestion, {target, props: {value}})

                      return target
                    },
                  }),
                  ...(commandTarget
                    ? [
                        CommandSuggestion({
                          editor: this.editor,
                          search: (term: string) => get(commandSearch)?.searchValues(term) ?? [],
                          updateSignal: commandSearch,
                          getAttributes: getCommandAttributes,
                          createSuggestion: (value: string) => {
                            const target = document.createElement("div")

                            mount(CommandSuggestionItem, {target, props: {value, url: url ?? ""}})

                            return target
                          },
                        }),
                      ]
                    : []),
                ]
              },
            },
          },
        },
      }),
      NativeClipboardPasteExtension,
    ],
    onBlur: ({editor}) => resolveMentions(editor.view),
    onUpdate({editor}) {
      text?.set(editor.getText({blockSeparator: "\n"}))
      wordCount?.set(editor.storage.wordCount.words)
      charCount?.set(editor.storage.wordCount.chars)
      empty?.set(isEmpty(editor))
      setUploading()
      onChange?.(editor.getJSON())
    },
  })

  // The constructor's `content` option runs no paste rules, so seeded text would contribute no tags.
  if (typeof content === "string" && content) {
    ed.chain().setMeta("uiEvent", "paste").setContent(escapeHtml(content)).run()
  }

  // A draft saved mid-upload restores an attachment nothing is uploading, so pick it back up.
  if (typeof content === "object") {
    ed.chain().uploadFiles().run()
  }

  // Callers clear their draft when this reads true, so keep every await below the constructor.
  empty?.set(isEmpty(ed))
  text?.set(ed.getText({blockSeparator: "\n"}))

  // Deleting the url an attachment was inserted as is how you remove it, since there is no node.
  const getEditorTags = ed.storage.nostr.getEditorTags

  ed.storage.nostr.getEditorTags = (...args: unknown[]) => {
    const content = ed.getText({blockSeparator: "\n"})

    return [
      ...getEditorTags(...args),
      ...attachments.filter(({url}) => content.includes(url)).map(({tag}) => tag),
    ]
  }

  return ed
}
