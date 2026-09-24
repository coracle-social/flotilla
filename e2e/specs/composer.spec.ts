import type {Locator, Page} from "@playwright/test"
import {HOUR} from "@welshman/lib"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  GIF_BASE64,
  chatPath,
  chooseFile,
  composer,
  composerEnabled,
  dialog,
  expect,
  gifFile,
  makeTestUser,
  messageActions,
  mockBlossom,
  mockOpenRouterTranscription,
  roomLink,
  roomPath,
  sendButton,
  test,
  timeline,
  users,
} from "../harness"

const suggestions = (page: Page) => page.locator(".tiptap-suggestions__item")

// RoomCompose leads with a two button group: upload, then the create menu.
const roomUploadButton = (page: Page) => page.locator(".room__compose-inner .join-item").first()

const chatUploadButton = (page: Page) => page.locator("button[data-tip='Add an image']")

// The reply preview and the editing indicator are the same bordered strip, each with its own X.
const banner = (page: Page, text: string) =>
  page.locator(".room__compose .border-l-2").filter({hasText: text})

// prosemirror reads the file off the event, and playwright's dispatchEvent drops the dataTransfer.
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
    {name, data: GIF_BASE64},
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
    {name, data: GIF_BASE64},
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
    space.relayList(user.bob)
    space.message(user.bob, "general", "morning all", at(2, HOUR))

    // Someone matching the same term from a different space, to rank below this space's own members.
    other.room("lounge", {name: "Lounge"})
    other.join(user.alice, "lounge")
    other.join(outsider, "lounge")
    other.profile(outsider, {name: "Bobbin Amaranth"})
    other.relayList(outsider)
    other.message(outsider, "lounge", "hello from the lounge", at(2, HOUR))
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  // A profile reaches her by being rendered, and his never renders in the space she is typing in.
  const page = await as(users.alice, roomPath(other.url, "lounge"))

  // Exactly, since the join notice above his message carries his name too, as "@Bobbin Amaranth".
  await expect(
    timeline(page).getByRole("button", {name: "Bobbin Amaranth", exact: true}),
  ).toBeVisible()

  // A space's nav item is labeled with the name its nip-11 document reports.
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
      space.relayList(person)
      space.messagingRelayList(person)
    }
  })

  const path = roomPath(scenario.space("space").url, "general")

  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  const blossom = await mockBlossom(alice.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

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

  await expect(timeline(alice).locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()
  await expect(timeline(bob).locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()

  await dropImage(composer(alice), "dropped.gif")

  await expect(composer(alice)).toContainText("dropped.gif")

  await pasteImage(composer(alice), "pasted.gif")

  await expect(composer(alice)).toContainText("pasted.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)

  // Its composer stays disabled until the recipient's messaging relays have been read.
  await alice.goto(chatPath(users.bob.pubkey))
  await bob.goto(chatPath(users.alice.pubkey))

  await composerEnabled(alice)

  await chooseFile(alice, chatUploadButton(alice), gifFile("selfie.gif"))

  await expect(composer(alice)).toContainText("selfie.gif")

  // Submit returns without a word while `uploading` is true, and encryption makes that window wide.
  await expect(sendButton(alice)).toBeEnabled()

  await composer(alice).press("Enter")

  // A conversation's image is uploaded encrypted, so the recipient decrypts it into a blob url.
  await expect(bob.locator('.chat-bubble img[src^="blob:"]')).toBeVisible()

  // Back to the room on a fresh page, so no toast the conversation raised is still standing.
  await alice.goto(path)

  await expect(timeline(alice).getByText("morning all")).toBeVisible()
  await expect(alice.getByRole("alert")).toHaveCount(0)

  // A file the editor has no node for is uploaded on its own and lands as a url.
  await chooseFile(alice, roomUploadButton(alice), {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  })

  await expect(composer(alice)).toContainText(DEFAULT_BLOSSOM_ORIGIN)
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

    // Her kind-10050 lets the Messages nav navigate; his enables the conversation's composer.
    for (const person of [user.alice, user.bob]) {
      space.profile(person, {name: person.name})
      space.relayList(person)
      space.messagingRelayList(person)
    }
  })

  // Drafts live in memory, so every move here is an in-app navigation.
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

  // The composer is remounted around a restored draft, so put the caret in it before sending.
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
    space.relayList(user.bob)
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

// Dictation's two buttons are one button in two states, so the label is what says which.
const dictateButton = (page: Page) => page.getByRole("button", {name: "Start dictation"})

const stopButton = (page: Page) => page.getByRole("button", {name: "Stop recording"})

// Every recording ends at the same question, so each spec starts from the answer it is about.
const record = async (page: Page) => {
  await dictateButton(page).click()
  await expect(stopButton(page)).toBeVisible()
  await stopButton(page).click()

  return dialog(page, "Transcribe or send?")
}

test("US-125 dictate a message", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "general")
    space.join(user.alice, "lounge")
    space.join(user.bob, "general")
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, roomPath(url, "general"))
  const transcription = await mockOpenRouterTranscription(alice.context(), "the tide turns at six")

  // Recording asks for nothing. Asking for a transcript with no key saved asks for one.
  const action = await record(alice)

  await action.getByRole("button", {name: "Transcribe it"}).click()

  const enable = dialog(alice, "Enable voice input?")

  await enable.locator('input[name="flotilla-openrouter-key"]').fill("sk-or-test")
  await enable.getByRole("button", {name: "Enable voice input"}).click()

  await expect(alice.getByRole("alert")).toContainText("Voice input is ready to use!")

  // The recording is still waiting behind that prompt for the answer it asked for.
  await action.getByRole("button", {name: "Transcribe it"}).click()

  await expect(composer(alice)).toContainText("the tide turns at six")

  // OpenRouter picks its decoder off the extension, so the upload has to name the format.
  expect(transcription.uploads).toEqual([expect.stringMatching(/^dictation\.\w+$/)])

  await composer(alice).press("Enter")

  await expect(timeline(alice)).toContainText("the tide turns at six")

  // A transcription outlives the composer that asked for it, and waits for whichever comes next.
  transcription.hold()

  await (await record(alice)).getByRole("button", {name: "Transcribe it"}).click()

  // A dictation is held by the app rather than by the composer, so reloading the page is losing it.
  await roomLink(alice, "Lounge").click()

  await expect(composer(alice)).toBeVisible()

  await roomLink(alice, "General").click()

  transcription.release()

  await expect(composer(alice)).toContainText("the tide turns at six")
})

test("US-126 send a voice note", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, roomPath(url, "general"))

  await mockBlossom(alice.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

  // Leaving the question unanswered throws the recording away.
  await (await record(alice)).getByRole("button", {name: "Discard"}).click()

  await expect(dialog(alice, "Transcribe or send?")).toHaveCount(0)
  await expect(composer(alice)).toHaveText("")

  // Sending the recording as it is needs no OpenRouter key, only somewhere to upload it.
  await (await record(alice)).getByRole("button", {name: "Send a voice note"}).click()

  await expect(composer(alice)).toContainText(DEFAULT_BLOSSOM_ORIGIN)

  await composer(alice).press("Enter")

  // The imeta on the message says the upload is audio, which gives it a player rather than a link.
  await expect(timeline(alice).locator(`audio[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()
})
