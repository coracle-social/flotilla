import {spec} from "@welshman/lib"
import {Clipboard} from "@capacitor/clipboard"
import {Capacitor} from "@capacitor/core"
import {Extension} from "@tiptap/core"
import {Plugin, PluginKey} from "@tiptap/pm/state"

const nativeClipboardAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Clipboard")

const hasStandardPastePayload = (event: ClipboardEvent) => {
  const clipboardData = event.clipboardData

  if (!clipboardData) {
    return false
  }

  if (Array.from(clipboardData.items).some(spec({kind: "file"}))) {
    return true
  }

  if (clipboardData.types.includes("text/html")) {
    return true
  }

  return clipboardData.getData("text/plain") !== ""
}

const getNativeClipboardImage = async () => {
  try {
    const {type, value} = await Clipboard.read()

    if (!type.startsWith("image/") || value === "") {
      return undefined
    }

    const imageData = value.startsWith("data:") ? value : `data:${type};base64,${value}`
    const blob = await fetch(imageData).then(res => res.blob())

    if (!blob.type.startsWith("image/")) {
      return undefined
    }

    const extension = type.split("/")[1]?.split("+")[0] || "png"

    return new File([blob], `clipboard-image.${extension}`, {type: blob.type || type})
  } catch {
    return undefined
  }
}

export const NativeClipboardPasteExtension = Extension.create({
  name: "nativeClipboardPaste",

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: new PluginKey("nativeClipboardPaste"),
        props: {
          handlePaste: (_view, event) => {
            if (!nativeClipboardAvailable() || hasStandardPastePayload(event)) {
              return false
            }

            event.preventDefault()

            void getNativeClipboardImage().then(file => {
              if (!file) {
                return
              }

              editor.commands.addFile(file, editor.state.selection.from + 1)
            })

            return true
          },
        },
      }),
    ]
  },
})
