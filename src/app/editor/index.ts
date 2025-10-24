import {mount} from "svelte"
import type {Writable} from "svelte/store"
import {get, derived} from "svelte/store"
import {Router} from "@welshman/router"
import {dec, inc} from "@welshman/lib"
import {throttled} from "@welshman/store"
import type {PublishedProfile} from "@welshman/util"
import {
  createSearch,
  profiles,
  searchProfiles,
  handlesByNip05,
  maxWot,
  wotGraph,
} from "@welshman/app"
import type {FileAttributes} from "@welshman/editor"
import {Editor, MentionSuggestion, WelshmanExtension} from "@welshman/editor"
import {makeMentionNodeView} from "@app/editor/MentionNodeView"
import ProfileSuggestion from "@app/editor/ProfileSuggestion.svelte"
import {uploadFile} from "@app/core/commands"
import {deriveSpaceMembers} from "@app/core/state"
import {pushToast} from "@app/util/toast"

export const makeEditor = async ({
  encryptFiles = false,
  aggressive = false,
  autofocus = false,
  charCount,
  content = "",
  placeholder = "",
  url,
  submit,
  uploading,
  wordCount,
}: {
  encryptFiles?: boolean
  aggressive?: boolean
  autofocus?: boolean
  charCount?: Writable<number>
  content?: string
  placeholder?: string
  url?: string
  submit: () => void
  uploading?: Writable<boolean>
  wordCount?: Writable<number>
}) => {
  const profileSearch = derived(
    [
      throttled(800, profiles),
      throttled(800, handlesByNip05),
      throttled(800, deriveSpaceMembers(url || "")),
    ],
    ([$profiles, $handlesByNip05, $spaceMembers]) => {
      // Remove invalid nip05's from profiles
      const options = $profiles.map(p => {
        const isNip05Valid = !p.nip05 || $handlesByNip05.get(p.nip05)?.pubkey === p.event.pubkey

        return isNip05Valid ? p : {...p, nip05: ""}
      })

      return createSearch(options, {
        onSearch: searchProfiles,
        getValue: (profile: PublishedProfile) => profile.event.pubkey,
        sortFn: ({score = 1, item}) => {
          const wotScore = wotGraph.get().get(item.event.pubkey) || 0
          const membershipScale = $spaceMembers.includes(item.event.pubkey) ? 2 : 1

          return dec(score) * inc(wotScore / maxWot.get()) * membershipScale
        },
        fuseOptions: {
          keys: [
            "nip05",
            {name: "name", weight: 0.8},
            {name: "display_name", weight: 0.5},
            {name: "about", weight: 0.3},
          ],
          threshold: 0.3,
          shouldSort: false,
        },
      })
    },
  )

  return new Editor({
    content,
    autofocus,
    element: document.createElement("div"),
    extensions: [
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
              upload: (attrs: FileAttributes) =>
                uploadFile(attrs.file, {url, encrypt: encryptFiles}),
              onDrop: () => uploading?.set(true),
              onComplete: () => uploading?.set(false),
              onUploadError(currentEditor, task) {
                currentEditor.commands.removeFailedUploads()
                pushToast({theme: "error", message: task.error})
                uploading?.set(false)
              },
            },
          },
          nprofile: {
            extend: {
              addNodeView: () => makeMentionNodeView(url),
              addProseMirrorPlugins() {
                return [
                  MentionSuggestion({
                    editor: (this as any).editor,
                    search: (term: string) => get(profileSearch).searchValues(term),
                    getRelays: (pubkey: string) => Router.get().FromPubkeys([pubkey]).getUrls(),
                    updateSignal: profileSearch,
                    createSuggestion: (value: string) => {
                      const target = document.createElement("div")

                      mount(ProfileSuggestion, {target, props: {value, url}})

                      return target
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
}
