import {mergeAttributes, Node} from "@tiptap/core"
import {RoomReferenceNodeView} from "@app/features/editor/RoomReferenceNodeView"

export const RoomReferenceExtension = Node.create({
  name: "roomref",

  atom: true,

  inline: true,

  group: "inline",

  selectable: true,

  priority: 1000,

  addAttributes() {
    return {
      url: {default: undefined},
      h: {default: undefined},
    }
  },

  parseHTML() {
    return [{tag: `span[data-type="${this.name}"]`}]
  },

  renderHTML({HTMLAttributes}) {
    return ["span", mergeAttributes(HTMLAttributes, {"data-type": this.name}), "~"]
  },

  renderText({node}) {
    const url = typeof node.attrs.url === "string" ? node.attrs.url : ""
    const h = typeof node.attrs.h === "string" ? node.attrs.h : ""

    return `${url}'${h}`
  },

  addNodeView() {
    return RoomReferenceNodeView
  },
})
