import type {NodeViewRendererProps} from "@tiptap/core"

export const CommandNodeView = ({node}: NodeViewRendererProps) => {
  const dom = document.createElement("span")
  const command = typeof node.attrs.command === "string" ? node.attrs.command : ""

  dom.classList.add("tiptap-object")
  dom.textContent = `/${command}`

  return {
    dom,
    selectNode() {
      dom.classList.add("tiptap-active")
    },
    deselectNode() {
      dom.classList.remove("tiptap-active")
    },
  }
}
