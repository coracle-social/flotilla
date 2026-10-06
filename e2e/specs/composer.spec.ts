import type {Locator, Page} from "@playwright/test"
import {HOUR, ms} from "@welshman/lib"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  GIF_BASE64,
  attachFile,
  chatPath,
  composer,
  composerAddButton,
  composerEnabled,
  dialog,
  expect,
  gifFile,
  makeTestUser,
  messageActions,
  mockBlossom,
  mockLocalSpeech,
  mockOpenRouterTranscription,
  roomLink,
  roomPath,
  sendButton,
  test,
  timeline,
  users,
} from "../harness"

const suggestions = (page: Page) => page.locator(".tiptap-suggestions__item")

// The reply preview and the editing indicator are the same bordered strip, each with its own X.
const banner = (page: Page, text: string) =>
  page.locator(".room__compose .border-l-2").filter({hasText: text})

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

  await attachFile(alice, gifFile("photo.gif"))

  await expect(sendButton(alice)).toBeDisabled()
  await expect(composerAddButton(alice)).toBeDisabled()

  // Deleting a stalled upload has to give the composer back.
  await composer(alice).press("ControlOrMeta+a")
  await composer(alice).press("Backspace")

  await expect(composer(alice)).not.toContainText("photo.gif")
  await expect(composerAddButton(alice)).toBeEnabled()

  await attachFile(alice, gifFile("photo.gif"))

  await expect(sendButton(alice)).toBeDisabled()

  blossom.release()

  await expect(sendButton(alice)).toBeEnabled()
  await expect(composer(alice)).toContainText("photo.gif")

  await composer(alice).press("Enter")

  await expect(timeline(alice).locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()
  await expect(timeline(bob).locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()

  await pasteImage(composer(alice), "pasted.gif")

  await expect(composer(alice)).toContainText("pasted.gif")

  // Its composer stays disabled until the recipient's messaging relays have been read.
  await alice.goto(chatPath(users.bob.pubkey))
  await bob.goto(chatPath(users.alice.pubkey))

  await composerEnabled(alice)

  await attachFile(alice, gifFile("selfie.gif"))

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

  // What the server refuses is what the composer refuses, in the words the server used.
  blossom.refuse("text files are not allowed here")

  await attachFile(alice, {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  })

  await expect(alice.getByRole("alert")).toContainText("text files are not allowed here")
})

test("US-142 an upload that never answers gives up", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: user.alice.name})
    space.relayList(user.alice)
  })

  const path = roomPath(scenario.space("space").url, "general")
  const alice = await as(users.alice, path)
  const blossom = await mockBlossom(alice.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

  blossom.hold()

  // A text file attaches as a link rather than a node, so there is nothing to delete while it uploads.
  await attachFile(alice, {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  })

  await expect(composerAddButton(alice)).toBeDisabled()

  await expect(alice.getByRole("alert")).toContainText("notes.txt took too long to upload", {
    timeout: ms(45),
  })

  await expect(composerAddButton(alice)).toBeEnabled()
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
})

const dictateButton = (page: Page) => page.getByRole("button", {name: "Start dictation"})

// The fake microphone beeps twice a second, so a shorter take records only silence.
const record = async (page: Page) => {
  const recorder = dialog(page, "Record a message")

  await dictateButton(page).click()
  // The dialog this one replaces is still animating out, so wait for it to be the only one.
  await expect(recorder).toHaveCount(1)
  await expect(recorder.getByText("0:01")).toBeVisible()

  return recorder
}

// A transcription that came back with nothing hands the recording back to the recorder.
const retryTranscribe = async (page: Page) => {
  const recorder = dialog(page, "Record a message")

  await expect(recorder).toHaveCount(1)
  await expect(recorder.locator("audio")).toBeVisible()
  await recorder.getByRole("button", {name: "Transcribe"}).click()
  await expect(composer(page)).toContainText("the tide turns at six")
  await composer(page).fill("")
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

  // Recording asks for nothing. Asking for a transcript with no provider set up asks for one.
  const recorder = await record(alice)

  await recorder.getByRole("button", {name: "Transcribe"}).click()

  const enable = dialog(alice, "Enable voice input?")

  // The prompt sits over the recorder rather than taking its place.
  await expect(enable).toHaveCount(1)
  await expect(recorder).toHaveCount(1)

  // Leaving the prompt hands the recording back to the recorder, still playable.
  await enable.getByRole("button", {name: "Go back"}).click()

  await expect(enable).toHaveCount(0)
  await expect(recorder.locator("audio")).toBeVisible()
  await recorder.getByRole("button", {name: "Transcribe"}).click()

  await enable.locator('input[name="flotilla-openrouter-key"]').fill("sk-or-test")
  await enable.getByRole("button", {name: "Enable voice input"}).click()

  await expect(alice.getByRole("alert")).toContainText("Voice input is ready to use!")

  // The recording is still waiting behind that prompt, so saving the key spends it.
  await expect(composer(alice)).toContainText("the tide turns at six")

  // OpenRouter picks its decoder off the extension, so the upload has to name the format.
  expect(transcription.uploads).toEqual([expect.stringMatching(/^dictation\.\w+$/)])

  await composer(alice).press("Enter")

  await expect(timeline(alice)).toContainText("the tide turns at six")

  // A transcription that fails says so and hands the recording back to the recorder.
  transcription.failNext("The model is overloaded")

  await (await record(alice)).getByRole("button", {name: "Transcribe"}).click()

  await expect(alice.getByRole("alert")).toContainText("The model is overloaded")
  await retryTranscribe(alice)

  // An empty transcript is silence rather than a failure, and the recording survives it too.
  transcription.setTranscript(" ")

  await (await record(alice)).getByRole("button", {name: "Transcribe"}).click()

  await expect(alice.getByRole("alert")).toContainText("No speech was detected")

  transcription.setTranscript("the tide turns at six")

  await retryTranscribe(alice)

  // A transcription that is still out holds the recorder open, with its own button busy.
  transcription.hold()

  const transcribing = await record(alice)
  const transcribeButton = transcribing.getByRole("button", {name: "Transcribe"})

  await transcribeButton.click()

  await expect(transcribeButton.locator(".spinner")).toBeVisible()
  await expect(transcribeButton).toBeDisabled()
  await expect(dictateButton(alice).locator(".spinner")).toHaveCount(0)

  // Leaving the recorder keeps the transcription, so the recording is not thrown away with it.
  await transcribing.getByRole("button", {name: "Close dialog"}).click()

  await expect(transcribing).toHaveCount(0)

  // A transcription outlives the composer that asked for it, and waits for whichever comes next.
  await roomLink(alice, "Lounge").click()

  await expect(composer(alice)).toBeVisible()

  await roomLink(alice, "General").click()

  // The composer it comes back to shows the wait the recorder was showing.
  await expect(dictateButton(alice).locator(".spinner")).toBeVisible()

  transcription.release()

  await expect(composer(alice)).toContainText("the tide turns at six")
})

test("US-142 transcribe a recording on this device", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, "/settings/content")
  const localSpeech = await mockLocalSpeech(alice.context(), {text: "the tide turns at six"})

  // Downloading the model is the whole of the choice, so no OpenRouter key is ever saved here.
  await alice.getByRole("button", {name: "Download model"}).click()

  const download = dialog(alice, "Download a speech model?")

  localSpeech.hold()

  await download.getByRole("button", {name: "Download model"}).click()

  // How far the download has got is a bar rather than a number in the status line.
  await expect(download.locator("progress")).toHaveJSProperty("value", 40)

  localSpeech.release()

  await expect(alice.getByRole("button", {name: "Remove model"})).toBeVisible()

  await alice.goto(roomPath(url, "general"))

  await (await record(alice)).getByRole("button", {name: "Transcribe"}).click()

  await expect(composer(alice)).toContainText("the tide turns at six")

  // The model reads the samples the recorder made rather than uploading a file anywhere.
  expect(localSpeech.recordings).toHaveLength(1)
  expect(localSpeech.recordings[0]).toBeGreaterThan(0)
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

  // Discarding the recording throws it away rather than attaching it.
  await (await record(alice)).getByRole("button", {name: "Discard"}).click()

  await expect(dialog(alice, "Record a message")).toHaveCount(0)
  await expect(composer(alice)).toHaveText("")

  // Sending the recording as it is needs no speech model, only somewhere to upload it.
  await (await record(alice)).getByRole("button", {name: "Send voice note"}).click()

  await expect(composer(alice)).toContainText(DEFAULT_BLOSSOM_ORIGIN)

  await composer(alice).press("Enter")

  // The imeta on the message says the upload is audio, which gives it a player rather than a link.
  await expect(timeline(alice).locator(`audio[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()
})
