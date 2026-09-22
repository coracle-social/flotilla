import {readFile} from "node:fs/promises"
import type {Page} from "@playwright/test"
import {npubEncode, nsecEncode} from "nostr-tools/nip19"
import {encrypt} from "nostr-tools/nip49"
import {hexToBytes} from "@welshman/lib"
import {expect, roomPath, spacePath, test, users} from "../harness"
import type {TestUser} from "../harness"

// The sign-in gate AppContainer renders in place of the app for anyone without a session.
const gate = (page: Page) => page.getByRole("heading", {name: "Welcome to Flotilla!"})

const nsecFor = (user: TestUser) => nsecEncode(hexToBytes(user.secret))

// Landing → "Log in" → "Log in with Key" → paste → submit, which is the only way to watch a
// session come into existence: a session injected by `as()` is re-applied on every navigation.
const logInWithKey = async (page: Page, key: string) => {
  await page.getByRole("button", {name: "Log in"}).click()
  await page.getByRole("button", {name: "Log in with Key"}).click()
  await page.getByPlaceholder("nsec1...").fill(key)
  // The landing page's own "Log in" is still behind the dialog, so submit is named by the form.
  await page.locator("form").getByRole("button", {name: "Log in", exact: true}).click()
}

// The nav's settings link carries its label as a tooltip rather than as an accessible name — its
// icon is a masked svg with no alt text — so it is addressed by where it goes.
const openSettings = (page: Page) =>
  page.locator('.primary-nav a[href="/settings/profile"]').click()

// The profile page's Public Key field. A nip01 login also renders a masked Private Key input right
// below it, so `getByRole("textbox")` on this page is two elements — the npub is the readonly one
// that isn't a password.
const npubField = (page: Page) => page.locator('input[readonly]:not([type="password"])')

test("US-001 sign-in gate for logged-out visitors", async ({seed, visit}) => {
  const scenario = await seed(({relay}) => {
    relay("space").room("general", {name: "General"})
  })

  const {url} = scenario.space("space")

  // A room url rather than the root: the gate stands in front of the whole app, so where the
  // visitor landed makes no difference.
  const page = await visit(roomPath(url, "general"))

  await expect(gate(page)).toBeVisible()
  const signInGate = page.getByRole("dialog", {name: "Welcome to Flotilla!"})
  const logIn = signInGate.getByRole("button", {name: "Log in"})

  await expect(signInGate).toBeVisible()
  await expect(logIn).toBeFocused()
  await expect(signInGate.getByRole("button", {name: "Close dialog"})).toHaveCount(0)
  await expect(page.getByRole("button", {name: "Log in"})).toBeVisible()
  await expect(page.getByRole("button", {name: "Create an account"})).toBeVisible()
  await expect(page.getByRole("link", {name: "Terms of Service"})).toHaveAttribute(
    "href",
    "https://flotilla.social/terms",
  )
  await expect(page.getByRole("link", {name: "Privacy Policy"})).toHaveAttribute(
    "href",
    "https://flotilla.social/privacy",
  )

  await page.keyboard.press("Escape")

  await expect(gate(page)).toBeVisible()

  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key)
    expect(await signInGate.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true)
  }

  await page.locator(".dialog-overlay > button").click({position: {x: 4, y: 4}})

  await expect(gate(page)).toBeVisible()

  await page.getByRole("button", {name: "Log in"}).click()

  await expect(page.getByRole("heading", {name: "Log in with Nostr"})).toBeVisible()

  await page.goBack()

  await expect(gate(page)).toBeVisible()

  await page.getByRole("button", {name: "Create an account"}).click()

  await expect(page.getByRole("heading", {name: "Create an Account"})).toBeVisible()
})

test("US-002 sign up by generating a new key", async ({seed, visit}) => {
  const scenario = await seed(({relay}) => {
    relay("space").room("general", {name: "General"})
  })

  const {url} = scenario.space("space")
  const page = await visit()

  await page.getByRole("button", {name: "Create an account"}).click()
  await page.getByRole("button", {name: "Generate a key"}).click()

  await page.locator('input[type="text"]').fill("Nova Tester")
  await page.getByRole("button", {name: "Create Account"}).click()

  await expect(page.getByRole("heading", {name: "Your Keys are Ready!"})).toBeVisible()

  const continueButton = page.getByRole("button", {name: "Continue"})
  const password = page.locator('input[type="password"]')

  await expect(continueButton).toBeDisabled()

  await page.getByRole("button", {name: "I want to download an encrypted version"}).click()
  await password.fill("hunter2")
  await page.getByRole("button", {name: "Download my key"}).click()

  await expect(page.getByRole("alert")).toContainText(
    "Your password must be at least 12 characters long.",
  )
  await expect(continueButton).toBeDisabled()

  await password.fill("correct horse battery staple")

  const download = page.waitForEvent("download")

  await page.getByRole("button", {name: "Download my key"}).click()

  const contents = await readFile(await (await download).path(), "utf8")

  expect(contents).toContain("ncryptsec1")
  expect(contents).not.toContain("nsec1")

  await expect(continueButton).toBeEnabled()
  await continueButton.click()

  await expect(page.getByRole("heading", {name: "You're all set!"})).toBeVisible()

  await page.getByRole("button", {name: "Go to Dashboard"}).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator(".primary-nav")).toBeVisible()
  await expect(page.getByRole("heading", {name: "You're all set!"})).toHaveCount(0)
  await expect(gate(page)).toHaveCount(0)

  // A space's nav item is a button rather than a link — PrimaryNavItemSpace passes an onclick, and
  // PrimaryNavItem renders a Button whenever it has one — so it is addressed by the tooltip it
  // carries, which is the relay's nip-11 name, and clicking it is what says which space it is.
  const spaceItem = page.locator('.primary-nav [data-tip="space"]')

  await expect(spaceItem).toBeVisible()
  await spaceItem.click()
  await expect(page).toHaveURL(new RegExp(spacePath(url)))

  await openSettings(page)

  await expect(page.getByText("Nova Tester")).toBeVisible()
})

test("US-003 log in with an existing private key", async ({seed, visit}) => {
  await seed(({relay}) => {
    relay("space").room("general", {name: "General"})
  })

  const aliceNpub = npubEncode(users.alice.pubkey)
  const password = "a very good password"
  const ncryptsec = encrypt(hexToBytes(users.alice.secret), password)

  const withNsec = await visit()

  await logInWithKey(withNsec, nsecFor(users.alice))
  await expect(withNsec.locator(".primary-nav")).toBeVisible()
  await openSettings(withNsec)
  await expect(npubField(withNsec)).toHaveValue(aliceNpub)

  const withHex = await visit()

  await logInWithKey(withHex, users.alice.secret)
  await expect(withHex.locator(".primary-nav")).toBeVisible()
  await openSettings(withHex)
  await expect(npubField(withHex)).toHaveValue(aliceNpub)

  const withNcryptsec = await visit()

  await withNcryptsec.getByRole("button", {name: "Log in"}).click()
  await withNcryptsec.getByRole("button", {name: "Log in with Key"}).click()

  const key = withNcryptsec.getByPlaceholder("nsec1...")
  const submit = withNcryptsec.locator("form").getByRole("button", {name: "Log in", exact: true})

  await key.fill("this is not a key")
  await expect(submit).toBeDisabled()

  await key.fill(ncryptsec)
  await withNcryptsec.getByPlaceholder("Your password").fill("not the password")
  await submit.click()

  await expect(withNcryptsec.getByRole("alert")).toContainText(
    "Failed to decrypt key. Please check your password.",
  )
  await expect(withNcryptsec.getByRole("heading", {name: "Log In with Key"})).toBeVisible()
  await expect(withNcryptsec.locator(".primary-nav")).toHaveCount(0)

  await withNcryptsec.getByPlaceholder("Your password").fill(password)
  await submit.click()

  await expect(withNcryptsec.locator(".primary-nav")).toBeVisible()
  await openSettings(withNcryptsec)
  await expect(npubField(withNcryptsec)).toHaveValue(aliceNpub)

  // A second browser context with its own storage: bob's session is his own, not a second view
  // of alice's.
  const asBob = await visit()

  await logInWithKey(asBob, nsecFor(users.bob))
  await openSettings(asBob)
  await expect(npubField(asBob)).toHaveValue(npubEncode(users.bob.pubkey))
})

test("US-004 log in with a browser extension", async ({seed, visit}) => {
  await seed(({relay}) => {
    relay("space").room("general", {name: "General"})
  })

  const page = await visit("/", {nip07: users.alice})

  await page.getByRole("button", {name: "Log in"}).click()
  await page.getByRole("button", {name: "Log in with Extension"}).click()

  await expect(page.locator(".primary-nav")).toBeVisible()

  await openSettings(page)

  await expect(page.getByRole("textbox")).toHaveValue(npubEncode(users.alice.pubkey))
  await expect(page.locator('input[type="password"]')).toHaveCount(0)

  const withoutExtension = await visit()

  await withoutExtension.getByRole("button", {name: "Log in"}).click()

  await expect(
    withoutExtension.getByRole("button", {name: "Log in with Remote Signer"}),
  ).toBeVisible()
  await expect(withoutExtension.getByRole("button", {name: "Log in with Extension"})).toHaveCount(0)
})

test("US-005 log in with a remote signer", async ({seed, visit}) => {
  await seed(({relay}) => {
    relay("space").room("general", {name: "General"})
  })

  const page = await visit()

  await page.getByRole("button", {name: "Log in"}).click()
  await page.getByRole("button", {name: "Log in with Remote Signer"}).click()

  const bunker = page.getByPlaceholder("bunker://")
  const next = page.getByRole("button", {name: "Next"})

  // The relay named here belongs to no scenario, so a connection attempt would be recorded as a
  // leak and fail this test rather than passing unnoticed.
  await bunker.fill("bunker://not-a-signer-pubkey?relay=wss://nowhere.test/")
  await next.click()

  await expect(page.getByRole("alert")).toContainText(
    "Sorry, it looks like that's an invalid bunker link.",
  )

  await bunker.fill(`bunker://${users.carol.pubkey}`)
  await next.click()

  await expect(page.getByRole("alert")).toContainText(
    "That bunker link does not include any relays.",
  )

  await page.getByRole("button", {name: "Log in with a QR code instead"}).click()

  await expect(page.getByText("Scan with your signer to log in, or click to copy.")).toBeVisible()

  await page.getByRole("button", {name: "Go back"}).click()

  await expect(bunker).toBeVisible()
})

test("US-006 stay logged in, and log out deliberately", async ({seed, visit}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const npub = npubEncode(users.alice.pubkey)
  const page = await visit()

  await logInWithKey(page, nsecFor(users.alice))

  await expect(page.locator(".primary-nav")).toBeVisible()

  await openSettings(page)

  await expect(npubField(page)).toHaveValue(npub)

  await page.reload()

  await expect(page.locator(".primary-nav")).toBeVisible()
  await expect(gate(page)).toHaveCount(0)
  await expect(npubField(page)).toHaveValue(npub)

  await page.locator(".secondary-nav").getByRole("button", {name: "Log Out"}).click()

  await expect(page.getByRole("heading", {name: /Are you sure you want/})).toBeVisible()
  await expect(page.getByText("Your local database will be cleared.")).toBeVisible()

  await page.getByRole("button", {name: "Go back"}).click()

  await expect(page.locator(".primary-nav")).toBeVisible()
  await expect(npubField(page)).toHaveValue(npub)

  await page.locator(".secondary-nav").getByRole("button", {name: "Log Out"}).click()
  await page.locator("form").getByRole("button", {name: "Log Out"}).click()

  await expect(gate(page)).toBeVisible()
})

test("US-007 inspect your keys and signer status", async ({seed, as, visit}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const npub = npubEncode(users.alice.pubkey)
  const page = await as(users.alice, "/settings/profile", {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  const readClipboard = () => page.evaluate(() => navigator.clipboard.readText())

  const npubInput = npubField(page)

  await expect(npubInput).toHaveValue(npub)
  await expect(npubInput).toHaveJSProperty("readOnly", true)

  await page.locator("label.input").filter({has: npubInput}).getByRole("button").click()

  await expect.poll(readClipboard).toBe(npub)

  const secretInput = page.locator('input[type="password"]')

  await expect(secretInput).toHaveValue(users.alice.secret)

  await page.locator("label.input").filter({has: secretInput}).getByRole("button").click()

  await expect.poll(readClipboard).toBe(nsecFor(users.alice))

  const signerStatus = page.locator(".card").filter({hasText: "Signer Status"}).last()

  await expect(signerStatus).toContainText("Logged in with private key")
  await expect(signerStatus).toContainText("Ok")

  const succeeded = async () =>
    Number(/(\d+) requests succeeded/.exec(await signerStatus.innerText())?.[1])

  const before = await succeeded()

  await page.locator(".card").first().getByRole("button").click()
  await page.locator('input[type="text"]').first().fill("Alice Anderson")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your profile has been updated!")
  await expect.poll(succeeded).toBeGreaterThan(before)

  // An extension session holds no key for the app to show.
  const extension = await visit("/", {nip07: users.bob})

  await extension.getByRole("button", {name: "Log in"}).click()
  await extension.getByRole("button", {name: "Log in with Extension"}).click()

  await expect(extension.locator(".primary-nav")).toBeVisible()

  await openSettings(extension)

  await expect(extension.getByRole("textbox")).toHaveValue(npubEncode(users.bob.pubkey))
  await expect(extension.locator('input[type="password"]')).toHaveCount(0)
  await expect(extension.locator(".card").filter({hasText: "Signer Status"}).last()).toContainText(
    "Logged in with browser extension",
  )
})

test("US-008 delete your nostr account", async ({seed, as, visit}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const alice = await visit()

  await logInWithKey(alice, nsecFor(users.alice))
  await openSettings(alice)

  await alice.locator(".card").filter({hasText: "Advanced"}).getByRole("button").click()
  await alice.getByRole("button", {name: "Delete your profile"}).click()

  await expect(alice.getByRole("heading", {name: "Delete your account"})).toBeVisible()

  const confirm = alice.getByRole("button", {name: "Confirm"})
  const phrase = alice.locator('input[type="text"]')

  await expect(confirm).toBeDisabled()

  await phrase.fill("permanently delete my")

  await expect(confirm).toBeDisabled()

  await phrase.fill("permanently delete my nostr account")

  await expect(confirm).toBeEnabled()

  await confirm.click()

  await expect(alice.getByRole("progressbar")).toBeVisible()
  await expect(gate(alice)).toBeVisible()

  const bob = await as(users.bob, `/people/${npubEncode(users.alice.pubkey)}`)

  // zooid honours the kind-62 right-to-vanish, so alice's profile — including the "[deleted]" name
  // the app blanks it to first — is gone rather than renamed. Bob sees the npub fallback the app
  // shows for anyone with no profile: displayPubkey, which is npub.slice(0,8)+"…"+npub.slice(-5).
  const aliceNpub = npubEncode(users.alice.pubkey)
  const fallback = aliceNpub.slice(0, 8) + "…" + aliceNpub.slice(-5)

  await expect(bob.getByRole("heading", {name: fallback})).toBeVisible()

  // Her relay list went with the account, so the feed has nowhere to ask and keeps looking rather
  // than settling on its empty state. What the story is about is that nothing of hers comes back.
  await expect(bob.locator(".card.card-interactive")).toHaveCount(0)
})
