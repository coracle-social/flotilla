import type {NodeViewRendererProps} from "@tiptap/core"
import {displayRelayUrl} from "@welshman/util"
import {Rooms} from "@welshman/app"
import {fromApp} from "@app/core/app"

export const RoomReferenceNodeView = ({node}: NodeViewRendererProps) => {
  const dom = document.createElement("span")
  const url = typeof node.attrs.url === "string" ? node.attrs.url : ""
  const h = typeof node.attrs.h === "string" ? node.attrs.h : ""
  const room = fromApp($app => $app.use(Rooms).forRoom(url, h))

  dom.classList.add("tiptap-object")

  const unsubRoom = room.subscribe($room => {
    dom.textContent = `~${displayRelayUrl(url)} / ${$room?.meta?.name() || h}`
  })

  return {
    dom,
    destroy: () => {
      unsubRoom()
    },
    selectNode() {
      dom.classList.add("tiptap-active")
    },
    deselectNode() {
      dom.classList.remove("tiptap-active")
    },
  }
}
