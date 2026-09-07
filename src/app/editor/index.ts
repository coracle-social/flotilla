import {mount} from "svelte"
import type {Writable} from "svelte/store"
import {get, derived} from "svelte/store"
import {sortBy, uniq} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {createSearch, splitRoomKey} from "@welshman/app"
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
import {escapeHtml} from "@lib/html"
import {profiles, relayLists, relayMemberLists, rooms} from "@app/core"
import {
  commands,
  createCommandSearch,
  getCommandByAddress,
  getCommandsForTarget,
} from "@app/commands"
import {CommandNodeView} from "@app/editor/CommandNodeView"
import CommandSuggestionItem from "@app/editor/CommandSuggestion.svelte"
import {MentionNodeView} from "@app/editor/MentionNodeView"
import ProfileSuggestion from "@app/editor/ProfileSuggestion.svelte"
import {RoomReferenceExtension} from "@app/editor/RoomReferenceExtension"
import RoomSuggestion from "@app/editor/RoomSuggestion.svelte"
import {NativeClipboardPasteExtension} from "@app/editor/clipboard"
import {UPLOAD_MIME_TYPES, compressFileForUpload, uploadFile} from "@app/uploads"
import {userSpaceUrls} from "@app/rooms"
import {PLATFORM_RELAYS} from "@app/env"
import {pushToast} from "@app/toast"

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
    [profiles.get().profileSearch, throttled(800, relayMemberLists.get().forUrl(url ?? ""))],
    ([$profileSearch, $spaceMembers]) => {
      const memberPubkeys = new Set($spaceMembers?.pubkeys())

      return (term: string) =>
        sortBy(pubkey => (memberPubkeys.has(pubkey) ? 0 : 1), $profileSearch.searchValues(term))
    },
  )

  const roomReferenceSearch = derived(
    [throttled(800, userSpaceUrls), throttled(800, rooms.get().byUrl.$)],
    ([$userSpaceUrls, $roomsByUrl]) => {
      // When platform relays are configured, restrict suggestions to those spaces.
      // Otherwise suggest rooms from the user's joined spaces plus the current one.
      const spaceUrls =
        PLATFORM_RELAYS.length > 0
          ? PLATFORM_RELAYS
          : uniq(url ? [url, ...$userSpaceUrls] : $userSpaceUrls)

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

  // The spec prefers a bare trigger, so qualify with the executor's pubkey only where the
  // trigger would otherwise reach more than one of them.
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

  const ed = new Editor({
    content: typeof content === "string" ? escapeHtml(content) : content,
    editorProps,
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
              allowedMimeTypes: UPLOAD_MIME_TYPES,
              upload: async (attrs: FileAttributes) =>
                uploadFile(await compressFileForUpload(attrs.file), {url, encrypt: encryptFiles}),
              onDrop: () => uploading?.set(true),
              onComplete: () => uploading?.set(false),
              onUploadError(currentEditor, task) {
                currentEditor.commands.removeFailedUploads()
                pushToast({theme: "error", message: task.error})
                uploading?.set(false)
              },
            },
            extend: {
              // The picker, a drop and a paste all reach the uploader through addFile, which
              // refuses a type that isn't allowed above by returning false and saying nothing.
              // Say it, or choosing the wrong file looks like the app simply ignored the click.
              onCreate() {
                const {uploader} = this.storage
                const addFile = uploader.addFile.bind(uploader)

                uploader.addFile = (file: File, pos: number) => {
                  const added = addFile(file, pos)

                  if (!added) {
                    pushToast({
                      theme: "error",
                      message: `${file.name} is not a type you can attach.`,
                    })
                  }

                  return added
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
                    editor: (this as any).editor,
                    search: (term: string) => get(searchProfiles)(term),
                    getRelays: (pubkey: string) => relayLists.get().writeUrls(pubkey).get(),
                    updateSignal: searchProfiles,
                    createSuggestion: (value: string) => {
                      const target = document.createElement("div")

                      mount(ProfileSuggestion, {target, props: {value, url}})

                      return target
                    },
                  }),
                  TippySuggestion({
                    char: "~",
                    name: "roomref",
                    editor: (this as any).editor,
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
                          editor: (this as any).editor,
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
    onUpdate({editor}) {
      text?.set(editor.getText({blockSeparator: "\n"}))
      wordCount?.set(editor.storage.wordCount.words)
      charCount?.set(editor.storage.wordCount.chars)
      empty?.set(isEmpty(editor))
      onChange?.(editor.getJSON())
    },
  })

  // Seed the caller's store from the document tiptap actually parsed — a restored draft is a
  // document even when it holds no text, so the caller can't tell from `content` alone. Callers
  // clear their draft when this reads true, so it has to be set before they render: keep every
  // await in this function inside a callback, below the constructor.
  empty?.set(isEmpty(ed))
  text?.set(ed.getText({blockSeparator: "\n"}))

  return ed
}
