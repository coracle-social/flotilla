import {mount} from "svelte"
import type {Writable} from "svelte/store"
import {get} from "svelte/store"
import {Router} from "@welshman/router"
import {profileSearch} from "@welshman/app"
import type {FileAttributes} from "@welshman/editor"
import {Editor, MentionSuggestion, WelshmanExtension} from "@welshman/editor"
import {makeMentionNodeView} from "@app/editor/MentionNodeView"
import ProfileSuggestion from "@app/editor/ProfileSuggestion.svelte"
import {uploadFile} from "@app/core/commands"
import {pushToast} from "@app/util/toast"

export const makeEditor = async ({
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
              upload: (attrs: FileAttributes) => uploadFile(attrs.file, {url, encrypt: true}),
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
