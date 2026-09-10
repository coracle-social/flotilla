import type {Locator, Page} from "@playwright/test"
import {HOUR} from "@welshman/lib"
import {MessagingRelayList, RelayList} from "@welshman/domain"
import {expect, makeTestUser, mockBlossom, roomPath, test, users} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// The path the app builds for a conversation — see makeChatId in src/app/chats.ts.
const chatPath = (...pubkeys: string[]) => `/chat/${[...pubkeys].sort().join(",")}`

// Where an upload lands: the space's own origin is probed first and blossom is off in every
// tenant's toml, so what is left is VITE_DEFAULT_BLOSSOM_SERVERS.
const BLOSSOM_ORIGIN = "https://blossom.primal.net"

// A one pixel gif. Gif rather than png because compressFileForUpload passes it through untouched
// rather than re-encoding it through a canvas, so the mock stores the bytes the browser was handed.
const GIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

const gifFile = (name: string) => ({
  name,
  mimeType: "image/gif",
  buffer: Buffer.from(GIF, "base64"),
})

// Outbox routing resolves everything about a person through their relay list, so a seeded profile
// is only loadable by somebody else once its author has one.
const seedRelayList = (space: SeededSpace, user: TestUser) =>
  space.event(user, () =>
    space
      .kind(RelayList)
      .writer()
      .setReadUrls([space.url])
      .setWriteUrls([space.url])
      .renderTemplate(),
  )

// The kind-10050 a conversation needs at both ends: the recipient's is what enables the composer,
// the sender's is what routes their own copy of the wrap back to them.
const seedMessagingRelays = (space: SeededSpace, user: TestUser) =>
  space.event(user, () =>
    space.kind(MessagingRelayList).writer().setUrls([space.url]).renderTemplate(),
  )

const composer = (page: Page) => page.locator(".chat-editor [contenteditable=true]")

// The send button carries the shortcut it advertises, which differs by platform.
const sendButton = (page: Page) => page.locator("button[data-tip$='enter to send']")

// The editor is where the composer says whether it is ready. The send button is not there to
// ask while the composer is empty, since a dictation button stands in its place.
const composerEnabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "false")

const suggestions = (page: Page) => page.locator(".tiptap-suggestions__item")

const timeline = (page: Page) => page.locator(".room__content")

// RoomCompose leads with a two button group: upload, then the create menu.
const roomUploadButton = (page: Page) => page.locator(".room__compose-inner .join-item").first()

const chatUploadButton = (page: Page) => page.locator("button[data-tip='Add an image']")

// Both things the composer puts above itself — the message being replied to and the editing
// indicator — are the same bordered strip, each with a single button in it: its X.
const banner = (page: Page, text: string) =>
  page.locator(".room__compose .border-l-2").filter({hasText: text})

// RoomItem gives its hover actions no accessible names — every one is an icon. Their order is
// fixed by the component: zap, emoji, reply, edit (only on your own recent message), menu.
const messageActions = (page: Page, text: string) =>
  page.locator(".room__item").filter({hasText: text}).locator(".room__item-actions button")

const chooseFile = async (
  page: Page,
  button: Locator,
  file: {name: string; mimeType: string; buffer: Buffer},
) => {
  const chooser = page.waitForEvent("filechooser")

  await button.click()
  await (await chooser).setFiles(file)
}

// Both of these are DataTransfer dispatches rather than anything native: prosemirror reads the file
// straight off the event, and playwright's own dispatchEvent builds a plain Event, which would drop
// the dataTransfer the handler needs.
const dropImage = (editor: Locator, name: string) =>
  editor.evaluate(
    (node, {name, data}) => {
      const transfer = new DataTransfer()
      const {left, top, width, height} = node.getBoundingClientRect()

      transfer.items.add(
        new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], name, {type: "image/gif"}),
      )

      node.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: left + width / 2,
          clientY: top + height / 2,
        }),
      )
    },
    {name, data: GIF},
  )

const pasteImage = (editor: Locator, name: string) =>
  editor.evaluate(
    (node, {name, data}) => {
      const transfer = new DataTransfer()

      transfer.items.add(
        new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], name, {type: "image/gif"}),
      )

      node.dispatchEvent(
        new ClipboardEvent("paste", {bubbles: true, cancelable: true, clipboardData: transfer}),
      )
    },
    {name, data: GIF},
  )

test("US-056 autocomplete a mention or a room reference", async ({seed, as}) => {
  const outsider = makeTestUser("bobbin")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Roberts", picture: "https://images.test/bob.png"})
    seedRelayList(space, user.bob)
    space.message(user.bob, "general", "morning all", at(2, HOUR))

    // Someone whose name matches the same term but who belongs to a different space, so the
    // dropdown has a non-member to rank below this space's own members.
    other.room("lounge", {name: "Lounge"})
    other.join(user.alice, "lounge")
    other.join(outsider, "lounge")
    other.profile(outsider, {name: "Bobbin Amaranth"})
    seedRelayList(other, outsider)
    other.message(outsider, "lounge", "hello from the lounge", at(2, HOUR))
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  // Alice arrives through the other space so that the outsider's profile is in her client before
  // she composes: a profile reaches her by being rendered, and his never renders in the space she
  // is about to type in.
  const page = await as(users.alice, roomPath(other.url, "lounge"))

  // Exactly, since the join notice above his message carries his name too, as "@Bobbin Amaranth".
  await expect(
    timeline(page).getByRole("button", {name: "Bobbin Amaranth", exact: true}),
  ).toBeVisible()

  // A space's nav item is labeled with the name its nip-11 document reports, and the two tenants
  // report "space" and "other".
  await page.locator('.primary-nav [data-tip="space"]').click()
  await page.locator(".secondary-nav").getByRole("link", {name: "General"}).click()

  await expect(timeline(page).getByText("morning all")).toBeVisible()

  const editor = composer(page)

  await editor.click()
  await editor.pressSequentially("@bob")

  // This space's own member first, the outsider from the other space under him.
  await expect(suggestions(page)).toContainText(["Bob Roberts", "Bobbin Amaranth"])

  await editor.pressSequentially("bin")

  await expect(suggestions(page)).toContainText(["Bobbin Amaranth"])

  // Back to "@bob", where both of them are on offer again.
  await editor.press("Backspace")
  await editor.press("Backspace")
  await editor.press("Backspace")

  await expect(suggestions(page)).toContainText(["Bob Roberts", "Bobbin Amaranth"])

  await suggestions(page).filter({hasText: "Bob Roberts"}).click()

  const mention = editor.locator(".tiptap-object")

  await expect(mention).toHaveText("@Bob Roberts")

  await editor.pressSequentially("are you around?")
  await editor.press("Enter")

  const sent = page.locator(".room__item").filter({hasText: "are you around?"})
  const sentMention = sent.getByRole("button", {name: "@Bob Roberts"})

  await expect(sentMention).toBeVisible()

  await editor.pressSequentially("~gene")

  await expect(suggestions(page)).toContainText(["General"])

  await suggestions(page).filter({hasText: "General"}).click()

  await expect(editor.locator(".tiptap-object")).toContainText("General")

  await editor.press("Enter")

  await expect(timeline(page).getByRole("link", {name: /#\s*General/})).toHaveAttribute(
    "href",
    roomPath(space.url, "general"),
  )
})

test("US-057 attach and send an image", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "morning all", at(2, HOUR))

    for (const person of [user.alice, user.bob]) {
      space.profile(person, {name: person.name})
      seedRelayList(space, person)
      seedMessagingRelays(space, person)
    }
  })

  const path = roomPath(scenario.space("space").url, "general")

  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  const blossom = await mockBlossom(alice.context(), {server: BLOSSOM_ORIGIN})

  await blossom.install(bob.context())

  await expect(timeline(alice).getByText("morning all")).toBeVisible()

  blossom.hold()

  await chooseFile(alice, roomUploadButton(alice), gifFile("photo.gif"))

  await expect(alice.locator(".room__compose-inner .spinner")).toBeVisible()
  await expect(sendButton(alice)).toBeDisabled()

  blossom.release()

  await expect(sendButton(alice)).toBeEnabled()
  await expect(composer(alice)).toContainText("photo.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)

  await composer(alice).press("Enter")

  await expect(timeline(alice).locator(`img[src^="${BLOSSOM_ORIGIN}/"]`)).toBeVisible()
  await expect(timeline(bob).locator(`img[src^="${BLOSSOM_ORIGIN}/"]`)).toBeVisible()

  await dropImage(composer(alice), "dropped.gif")

  await expect(composer(alice)).toContainText("dropped.gif")

  await pasteImage(composer(alice), "pasted.gif")

  await expect(composer(alice)).toContainText("pasted.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)

  // The same thing in a conversation. Its composer stays disabled until the recipient's messaging
  // relays have been read, which is what waiting on the composer waits out.
  await alice.goto(chatPath(users.bob.pubkey))
  await bob.goto(chatPath(users.alice.pubkey))

  await composerEnabled(alice)

  await chooseFile(alice, chatUploadButton(alice), gifFile("selfie.gif"))

  await expect(composer(alice)).toContainText("selfie.gif")

  // The file node appears the moment it is attached, which is also the moment `uploading` goes
  // true — and submit returns without a word while it is. Encryption makes that window wide enough
  // to press enter into, so wait the upload out rather than losing the message to it.
  await expect(sendButton(alice)).toBeEnabled()

  await composer(alice).press("Enter")

  // A conversation's image is uploaded encrypted, so the recipient fetches the ciphertext and
  // decrypts it into a blob url rather than pointing an <img> at the server.
  await expect(bob.locator('.chat-bubble img[src^="blob:"]')).toBeVisible()

  // Back to the room on a fresh page, so no toast the conversation raised is still standing and the
  // one asserted below can only be the rejected upload's own.
  await alice.goto(path)

  await expect(timeline(alice).getByText("morning all")).toBeVisible()
  await expect(alice.getByRole("alert")).toHaveCount(0)

  // A file the editor has no node for is uploaded on its own and lands as a url.
  await chooseFile(alice, roomUploadButton(alice), {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  })

  await expect(composer(alice)).toContainText(BLOSSOM_ORIGIN)
  await expect(alice.getByRole("alert")).toHaveCount(0)

  // What the server refuses is what the composer refuses, in the words the server used.
  blossom.refuse("text files are not allowed here")

  await chooseFile(alice, roomUploadButton(alice), {
    name: "notes-again.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("still not an image"),
  })

  await expect(alice.getByRole("alert")).toContainText("text files are not allowed here")
})

test("US-058 drafts survive navigating away", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "morning all", at(2, HOUR))

    // Alice's own kind-10050 is what lets the Messages nav item navigate rather than stop to ask
    // her to enable chat; bob's is what enables the conversation's composer.
    for (const person of [user.alice, user.bob]) {
      space.profile(person, {name: person.name})
      seedRelayList(space, person)
      seedMessagingRelays(space, person)
    }
  })

  // Drafts live in memory, so every move here is an in-app navigation — a reload would clear them
  // whether or not they were kept.
  const page = await as(users.alice, chatPath(users.bob.pubkey))
  const editor = composer(page)
  const rooms = page.locator(".secondary-nav")

  await composerEnabled(page)

  await editor.click()
  await editor.pressSequentially("still thinking about this")

  await page.locator('.primary-nav [data-tip="space"]').click()
  await rooms.getByRole("link", {name: "General"}).click()

  await expect(timeline(page).getByText("morning all")).toBeVisible()
  await expect(editor).toHaveText("")

  await editor.click()
  await editor.pressSequentially("half a thought")

  await rooms.getByRole("link", {name: "Random"}).click()

  await expect(editor).toHaveText("")

  await rooms.getByRole("link", {name: "General"}).click()

  await expect(editor).toHaveText("half a thought")

  await page.locator('.primary-nav [data-tip="Messages"]').click()

  await expect(editor).toHaveText("still thinking about this")

  await page.locator('.primary-nav [data-tip="space"]').click()
  await rooms.getByRole("link", {name: "General"}).click()

  await expect(editor).toHaveText("half a thought")

  // The composer is remounted around a restored draft, so put the caret in it before sending
  // rather than typing into whatever had focus when the room came back.
  await editor.click()
  await editor.press("Enter")

  await expect(timeline(page).getByText("half a thought")).toBeVisible()
  await expect(editor).toHaveText("")

  await rooms.getByRole("link", {name: "Random"}).click()
  await rooms.getByRole("link", {name: "General"}).click()

  await expect(editor).toHaveText("")
})

test("US-059 cancel a reply or an edit in progress", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Roberts"})
    seedRelayList(space, user.bob)
    space.message(user.bob, "general", "morning all", at(2, HOUR))
  })

  const page = await as(users.alice, roomPath(scenario.space("space").url, "general"))
  const editor = composer(page)
  const replyBanner = banner(page, "Replying to @Bob Roberts")
  const editBanner = banner(page, "Editing message")

  await expect(timeline(page).getByText("morning all")).toBeVisible()

  // Only a message alice sent herself in the last five minutes offers an edit, so she sends one.
  await editor.click()
  await editor.pressSequentially("my first message")
  await editor.press("Enter")

  await expect(timeline(page).getByText("my first message")).toBeVisible()

  await editor.pressSequentially("half-written thought")

  // Bob's message offers zap, emoji, reply and the menu; alice's own also offers the edit.
  await expect(messageActions(page, "morning all")).toHaveCount(4)
  await expect(messageActions(page, "my first message")).toHaveCount(5)

  await messageActions(page, "morning all").nth(2).click()

  await expect(replyBanner).toContainText("morning all")

  await editor.press("Escape")

  await expect(replyBanner).toHaveCount(0)
  await expect(editor).toHaveText("half-written thought")

  await messageActions(page, "morning all").nth(2).click()

  await expect(replyBanner).toBeVisible()

  await replyBanner.getByRole("button").click()

  await expect(replyBanner).toHaveCount(0)
  await expect(editor).toHaveText("half-written thought")

  await messageActions(page, "my first message").nth(3).click()

  await expect(editBanner).toBeVisible()
  await expect(editor).toHaveText("my first message")

  await editor.press("Escape")

  await expect(editBanner).toHaveCount(0)
  await expect(editor).toHaveText("half-written thought")

  await messageActions(page, "my first message").nth(3).click()

  await expect(editBanner).toBeVisible()

  await editBanner.getByRole("button").click()

  await expect(editBanner).toHaveCount(0)
  await expect(editor).toHaveText("half-written thought")

  // Neither message was touched, and the draft never left the composer.
  await expect(timeline(page).getByText("morning all")).toHaveCount(1)
  await expect(timeline(page).getByText("my first message")).toHaveCount(1)
  await expect(timeline(page).getByText("half-written thought")).toHaveCount(0)
})
