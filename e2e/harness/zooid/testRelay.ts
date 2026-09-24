import {
  MESSAGE,
  RELAY_JOIN,
  ROOM_ADD_MEMBER,
  ROOM_CREATE,
  ROOM_EDIT_META,
  makeEvent,
} from "@welshman/util"
import type {SignedEvent, StampedEvent} from "@welshman/util"
import {users} from "../keys"
import type {TestUser} from "../keys"
import type {PublishOptions, TestRelay} from "./types"

export type TestRelayOptions = {
  name: string
  url: string
  publish: (event: SignedEvent, options?: PublishOptions) => Promise<void>
}

// admin is the only test identity the tomls grant can_manage, and every timestamp is the caller's.
export const makeTestRelay = ({name, url, publish}: TestRelayOptions): TestRelay => {
  const event = async (user: TestUser, template: StampedEvent) => {
    const signed = await user.signer.sign(template)

    await publish(signed)

    return signed
  }

  return {
    name,
    url,
    event,
    publish,
    room: async (h, meta, createdAt) => {
      // A relay stamps derived metadata with the op's created_at, so creation must be older than an edit.
      await event(
        users.admin,
        makeEvent(ROOM_CREATE, {tags: [["h", h]], created_at: createdAt - 1}),
      )

      const tags = [["h", h]]

      if (meta.name) {
        tags.push(["name", meta.name])
      }
      if (meta.about) {
        tags.push(["about", meta.about])
      }
      if (meta.picture) {
        tags.push(["picture", meta.picture])
      }
      if (meta.closed) {
        tags.push(["closed"])
      }
      if (meta.private) {
        tags.push(["private"])
      }

      await event(users.admin, makeEvent(ROOM_EDIT_META, {tags, created_at: createdAt}))
    },
    message: (user, h, content, createdAt) =>
      event(user, makeEvent(MESSAGE, {content, tags: [["h", h]], created_at: createdAt})),
    member: async (user, h, createdAt) => {
      await event(user, makeEvent(RELAY_JOIN, {created_at: createdAt}))

      if (h) {
        const tags = [
          ["h", h],
          ["p", user.pubkey],
        ]

        await event(users.admin, makeEvent(ROOM_ADD_MEMBER, {tags, created_at: createdAt}))
      }
    },
  }
}
