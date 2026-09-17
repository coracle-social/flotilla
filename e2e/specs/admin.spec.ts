import type {Locator, Page} from "@playwright/test"
import {DAY, HOUR, MINUTE, MONTH, now} from "@welshman/lib"
import {Article} from "@welshman/domain"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  dialog,
  expect,
  getHosting,
  gifFile,
  makeTestUser,
  menuButton,
  mockBlossom,
  openMessageMenu,
  roomPath,
  spacePath,
  test,
  users,
} from "../harness"

const ICON = gifFile("icon.gif")

// The plans the hosting backend offers. `free` is what RelayForm starts on, and `basic` is the paid
// one every upgrade story moves to. PricingTable names a plan by its member limit, which is the
// only part of a card that differs between the two.
const PLANS = [
  {id: "free", name: "Free", amount: 0, hidden: false, members: 50, blossom: false, livekit: false},
  {
    id: "basic",
    name: "Basic",
    amount: 500,
    hidden: false,
    // Plan["members"] is number | null upstream; null is how the hosting API spells "unlimited".
    // eslint-disable-next-line no-restricted-syntax
    members: null,
    blossom: true,
    livekit: true,
  },
]

// One relay as the hosting api serves it. Every field RelayDetailCard reads is present, since it
// calls .trim() and .replace() on several of them.
const hostedRelay = (overrides: Record<string, unknown> = {}) => ({
  id: "relay-1",
  tenant_pubkey: users.alice.pubkey,
  subdomain: "space",
  zooid_domain: "test",
  plan_id: "free",
  status: "active",
  sync_error: "",
  synced: now(),
  custom_domain: "",
  custom_domain_verified: 0,
  info_name: "Space",
  info_icon: "",
  info_description: "",
  policy_public_read: 0,
  policy_public_write: 0,
  policy_public_join: 1,
  policy_strip_signatures: 0,
  groups_enabled: 1,
  management_enabled: 1,
  blossom_enabled: 0,
  livekit_enabled: 0,
  push_enabled: 1,
  ...overrides,
})

// Tippy mounts a menu the first time it is opened and leaves it in the dom when it hides, so a page
// that has opened two of them holds both — only the one on screen is visible. Exact, because
// "Edit role" and "Edit roles" are two different menus in the same directory.
const menuItem = (page: Page, name: string) =>
  page.getByRole("button", {name, exact: true}).filter({visible: true})

// Every space-level admin action hangs off the space menu, which opens from the header button in
// the secondary nav. That button is labeled with the space's name and its host, and only the host
// survives a rename.
const openSpaceMenu = (page: Page) => page.getByRole("button", {name: /space\.test/}).click()

// SpaceMember covers its card with a button whose aria-label is baked from the profile display at
// first render — before the profile has loaded — so the card is found by the name it shows rather
// than by that label. It is the only interactive card in the directory, and the member's own menu
// is the last button inside it.
const memberCard = (page: Page, name: string) =>
  page.locator(".card-interactive").filter({hasText: name})

const openEventMenu = (card: Locator) => menuButton(card).click()

const articleCard = (page: Page, title: string) =>
  page.locator('[data-component="ArticleItem"]').filter({hasText: title})

// A FieldInline puts its control in the div immediately after its label, which is how one row of
// the hosting card is told apart from the others in the same grid.
const setting = (page: Page, label: string) =>
  page.locator("label").filter({hasText: label}).locator("xpath=following-sibling::div")

const settingToggle = (page: Page, label: string) => setting(page, label).getByRole("checkbox")

// A hosted relay's status and its plan each render as a badge beside its name.
const badge = (page: Page, text: string) => page.locator(".badge").filter({hasText: text})

test("US-092 edit a space's profile and featured content", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, spacePath(url) + "/about")

  await mockBlossom(admin.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

  await openSpaceMenu(admin)
  await menuItem(admin, "Edit Space").click()

  const editor = dialog(admin, "Edit this Space")

  await expect(editor).toBeVisible()

  await editor.getByRole("button", {name: "Add an image"}).click()

  // The upload's file input is hidden inside its own label, so the chooser is opened by clicking
  // the label rather than by writing to the input. Picking a file dismisses the picker.
  const picker = dialog(admin, "Add an image")
  const chooser = admin.waitForEvent("filechooser")

  await picker.locator('label:has(input[type="file"])').click()
  await (await chooser).setFiles(ICON)

  await expect(editor.getByText("Selected:")).toBeVisible()

  await editor.locator('input[type="text"]').fill("Harbor")
  await editor.locator("textarea").fill("Where the fleet ties up.")
  await editor.getByRole("button", {name: "Save Changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Your changes have been saved!")

  // All three come back off the relay's own nip-11 document
  await expect(admin.getByRole("heading", {name: "Harbor"})).toBeVisible()
  await expect(admin.getByText("Where the fleet ties up.")).toBeVisible()
  await expect(admin.locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}"]`).first()).toBeVisible()

  const featured = admin
    .locator(".card")
    .filter({has: admin.getByRole("heading", {name: "Featured"})})

  await expect(featured.getByText("No featured content yet.")).toBeVisible()

  await featured.getByRole("button").first().click()

  const featuredEditor = dialog(admin, "Featured Content")

  await featuredEditor.getByRole("button", {name: "Add content"}).click()
  await featuredEditor.getByPlaceholder("URL or nevent...").fill("Read the harbor rules first")
  await featuredEditor.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Featured content updated!")
  await expect(featured.getByText("Read the harbor rules first")).toBeVisible()

  // What admin published reaches every visitor, without any of the controls that produced it
  const bob = await as(users.bob, spacePath(url) + "/about")

  await expect(bob.getByRole("heading", {name: "Harbor"})).toBeVisible()

  const bobsFeatured = bob
    .locator(".card")
    .filter({has: bob.getByRole("heading", {name: "Featured"})})

  await expect(bobsFeatured.getByText("Read the harbor rules first")).toBeVisible()
  await expect(bobsFeatured.getByRole("button")).toHaveCount(0)

  await openSpaceMenu(bob)

  await expect(menuItem(bob, "Create Invite")).toBeVisible()
  await expect(bob.getByRole("button", {name: "Edit Space", exact: true})).toHaveCount(0)
})

test("US-093 create roles and assign them", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.profile(user.carol, {name: "Carol Cutter"})
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, spacePath(url) + "/directory")

  await expect(memberCard(admin, "Bob Barnacle")).toBeVisible()

  await admin.getByRole("button", {name: "More options"}).click()
  await menuItem(admin, "Manage Roles").click()

  const roles = dialog(admin, "Manage Roles")
  const emptyState = roles.getByText("No roles yet. Create one to start organizing members.")

  await expect(emptyState).toBeVisible()

  await roles.getByRole("button", {name: "Create Role"}).click()

  const roleForm = dialog(admin, "Create Role")

  await roleForm.getByPlaceholder("Moderator").fill("Deckhand")
  await roleForm.locator("textarea").fill("Keeps the decks in order.")
  await roleForm.getByRole("slider").fill("200")
  await roleForm.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Role created!")
  await expect(roles.locator(".role-badge")).toHaveText("Deckhand")

  // Editing the label rewrites the role rather than adding a second one
  await roles.locator(".card").filter({hasText: "Deckhand"}).getByRole("button").last().click()
  await menuItem(admin, "Edit role").click()

  const roleEditor = dialog(admin, "Edit Role")

  await roleEditor.getByPlaceholder("Moderator").fill("Bosun")
  await roleEditor.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Role updated!")
  await expect(roles.locator(".role-badge")).toHaveText("Bosun")

  // Handed out from the role's own menu...
  await roles.locator(".card").filter({hasText: "Bosun"}).getByRole("button").last().click()
  await menuItem(admin, "Add members").click()

  const addMembers = dialog(admin, "Add to Bosun")

  await addMembers.getByPlaceholder("Search for profiles...").fill("Bob")
  await admin.locator(".tiptap-suggestions").getByRole("button", {name: users.bob.pubkey}).click()
  await addMembers.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Members assigned!")

  await roles.getByRole("button", {name: "Go back"}).click()

  const bobsBadge = memberCard(admin, "Bob Barnacle").locator(".role-badge")

  await expect(bobsBadge).toHaveText("Bosun")
  await expect(bobsBadge).toHaveAttribute("style", /--role-color: hsl\(200/)

  // ...or from a member's own card, which is also how it comes back off
  await memberCard(admin, "Carol Cutter").getByRole("button").last().click()
  await menuItem(admin, "Edit roles").click()

  const carolsRoles = dialog(admin, "Edit Member")

  await carolsRoles.getByRole("checkbox").check()
  await carolsRoles.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Roles updated!")
  await expect(memberCard(admin, "Carol Cutter").locator(".role-badge")).toHaveText("Bosun")

  // The directory's search covers the roles a member holds as well as their name
  const term = admin.getByPlaceholder("Search people or roles...")

  await term.fill("Bosun")

  await expect(admin.locator(".card-interactive")).toHaveCount(2)
  await expect(memberCard(admin, "Bob Barnacle")).toBeVisible()
  await expect(memberCard(admin, "Carol Cutter")).toBeVisible()

  await term.fill("")

  await memberCard(admin, "Carol Cutter").getByRole("button").last().click()
  await menuItem(admin, "Edit roles").click()
  await carolsRoles.getByRole("checkbox").uncheck()
  await carolsRoles.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByRole("alert")).toContainText("Roles updated!")
  await expect(memberCard(admin, "Carol Cutter")).toBeVisible()
  await expect(memberCard(admin, "Carol Cutter").locator(".role-badge")).toHaveCount(0)

  await admin.getByRole("button", {name: "More options"}).click()
  await menuItem(admin, "Manage Roles").click()
  await roles.locator(".card").filter({hasText: "Bosun"}).getByRole("button").last().click()
  await menuItem(admin, "Delete role").click()

  const confirm = dialog(admin, "Delete Role")

  await expect(
    confirm.getByText('Delete the "Bosun" role? Members will keep their space membership.'),
  ).toBeVisible()

  await confirm.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Role deleted!")
  await expect(emptyState).toBeVisible()

  await roles.getByRole("button", {name: "Go back"}).click()

  await expect(memberCard(admin, "Bob Barnacle")).toBeVisible()
  await expect(memberCard(admin, "Bob Barnacle").locator(".role-badge")).toHaveCount(0)

  const bob = await as(users.bob, spacePath(url) + "/directory")

  await expect(memberCard(bob, "Carol Cutter")).toBeVisible()
  await expect(bob.getByRole("button", {name: "More options"})).toHaveCount(0)
})

test("US-094 invite people to a space", async ({seed, as}) => {
  const newcomer = makeTestUser("newcomer")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})

    // Somebody who belongs to a different space, so adding her here is a change to this space's
    // member list rather than something the scenario already seeded.
    other.room("lounge", {name: "Lounge"})
    other.join(user.admin, "lounge")
    other.join(newcomer, "lounge")
    other.profile(newcomer, {name: "Nadia Newcomer"})
    other.message(newcomer, "lounge", "hello from the lounge", at(2, HOUR))
  })

  const other = scenario.space("other")

  // Arriving through the other space is what loads Nadia's profile: the invite dialog's search
  // reads the profiles this client already holds.
  const page = await as(users.admin, roomPath(other.url, "lounge"), {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  await expect(page.getByText("Nadia Newcomer").first()).toBeVisible()

  // In-app navigation rather than a reload, which would empty the repository she was loaded into
  await page.locator('.primary-nav [data-tip^="space"]').click()
  await openSpaceMenu(page)
  await menuItem(page, "Create Invite").click()

  const invite = dialog(page, "Create an Invite")
  const link = invite.locator("input[readonly]")

  await expect(invite.locator("canvas")).toBeVisible()
  await expect(link).toHaveValue(/\/join\?r=space\.test&c=.+/)

  await invite.locator("label:has(input[readonly])").getByRole("button").click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await link.inputValue())

  await invite.getByPlaceholder("Search for profiles...").fill("Nadia")
  await page.locator(".tiptap-suggestions").getByRole("button", {name: newcomer.pubkey}).click()
  await invite.getByRole("button", {name: "Save", exact: true}).click()

  await expect(page.getByRole("alert")).toContainText("Members have successfully been added!")

  await page.locator(".secondary-nav").getByRole("link", {name: "Directory"}).click()

  await expect(memberCard(page, "Nadia Newcomer")).toBeVisible()

  // A room's own invite carries the space's claim and that room's join code alongside it
  await page.locator(".space-menu__scroll").getByRole("link", {name: "General"}).click()
  await page.locator('[data-component="PageBar"]').getByRole("button").last().click()
  await page.getByRole("button", {name: "Create invite"}).click()

  const roomInvite = dialog(page, "Create a Room Invite")

  await expect(roomInvite.locator("canvas")).toBeVisible()
  await expect(roomInvite.locator("input[readonly]")).toHaveValue(
    /\/join\?r=space\.test&c=[^&]+&h=general&code=.+/,
  )
})

test("US-095 remove, ban, and restore members", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.profile(user.carol, {name: "Carol Cutter"})
  })

  const {url} = scenario.space("space")

  // An ordinary member reads the same directory without any of the controls that manage it
  const bob = await as(users.bob, spacePath(url) + "/directory")
  const carolsCard = memberCard(bob, "Carol Cutter")

  await expect(carolsCard).toBeVisible()
  await expect(carolsCard.getByRole("button")).toHaveCount(1)
  await expect(bob.getByRole("button", {name: "More options"})).toHaveCount(0)

  const admin = await as(users.admin, spacePath(url) + "/directory")

  await memberCard(admin, "Bob Barnacle").getByRole("button").last().click()
  await menuItem(admin, "Remove member").click()

  const removal = dialog(admin, "Remove Member")

  await expect(removal.getByText("Remove @Bob Barnacle from the space?")).toBeVisible()

  await removal.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Member has successfully been removed!")
  await expect(memberCard(admin, "Bob Barnacle")).toHaveCount(0)

  await memberCard(admin, "Carol Cutter").getByRole("button").last().click()
  await menuItem(admin, "Ban member").click()

  const ban = dialog(admin, "Ban Member")

  await expect(ban.getByText("Ban @Carol Cutter from the space?")).toBeVisible()

  await ban.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Member has successfully been banned!")
  await expect(memberCard(admin, "Carol Cutter")).toHaveCount(0)

  await admin.getByRole("button", {name: "More options"}).click()
  await menuItem(admin, "Banned Members").click()

  const banned = dialog(admin, "Banned users")

  await expect(banned.getByText("Carol Cutter")).toBeVisible()

  await banned.locator(".card").filter({hasText: "Carol Cutter"}).getByRole("button").last().click()
  await menuItem(admin, "Restore User").click()

  await expect(admin.getByRole("alert")).toContainText(
    "User has successfully been restored to membership!",
  )
  await expect(memberCard(admin, "Carol Cutter")).toBeVisible()
})

test("US-096 moderate messages and posts", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.message(user.alice, "general", "the hull is patched", at(2, HOUR))
    space.message(user.bob, "general", "aye captain", at(90, MINUTE))

    space.event(
      user.bob,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("charting-the-reef")
          .setTitle("Charting the Reef")
          .setSummary("Where the shallows are.")
          .setPublishedAt(at(3, HOUR))
          .setContent("Mind the coral.")
          .renderTemplate(),
      at(3, HOUR),
    )

    // A second article, so a page with the deleted one missing is still a page that loaded
    space.event(
      user.alice,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("tides-and-timetables")
          .setTitle("Tides and Timetables")
          .setSummary("When to sail.")
          .setPublishedAt(at(4, HOUR))
          .setContent("Slack water is best.")
          .renderTemplate(),
      at(4, HOUR),
    )
  })

  const {url} = scenario.space("space")

  // An author gets a delete on their own content, and nothing to report
  const alice = await as(users.alice, roomPath(url, "general"))

  await expect(alice.getByText("the hull is patched")).toBeVisible()

  await openMessageMenu(alice, "the hull is patched")

  await expect(menuItem(alice, "Delete Message")).toBeVisible()
  await expect(alice.getByRole("button", {name: "Report Content", exact: true})).toHaveCount(0)

  await alice.goto(spacePath(url) + "/articles")
  await openEventMenu(articleCard(alice, "Tides and Timetables"))

  await expect(menuItem(alice, "Delete Article")).toBeVisible()

  // Everybody else gets a report instead, and the report needs a reason
  const bob = await as(users.bob, roomPath(url, "general"))

  await openMessageMenu(bob, "the hull is patched")

  await expect(menuItem(bob, "Report Content")).toBeVisible()
  await expect(bob.getByRole("button", {name: "Delete Message", exact: true})).toHaveCount(0)

  await menuItem(bob, "Report Content").click()

  const report = dialog(bob, "Report Content")

  await report.getByRole("button", {name: "Send Report"}).click()

  await expect(bob.getByRole("alert")).toContainText("Please select a reason for your report.")
  await expect(report).toBeVisible()

  await report.getByRole("combobox").selectOption("Spam")
  await report.getByRole("button", {name: "Send Report"}).click()

  await expect(bob.getByRole("alert")).toContainText("Your report has been sent!")

  // An admin gets a delete on anything, authored by them or not
  const admin = await as(users.admin, roomPath(url, "general"))

  await expect(admin.getByText("aye captain")).toBeVisible()

  await openMessageMenu(admin, "aye captain")
  await menuItem(admin, "Delete Message").click()

  const messageConfirm = dialog(admin, "Delete Message")

  await expect(
    messageConfirm.getByText("Are you sure you want to delete this message from the space?"),
  ).toBeVisible()

  await messageConfirm.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Event has successfully been deleted!")

  await admin.goto(spacePath(url) + "/articles")
  await openEventMenu(articleCard(admin, "Charting the Reef"))
  await menuItem(admin, "Delete Article").click()

  const articleConfirm = dialog(admin, "Delete Article")

  await expect(
    articleConfirm.getByText("Are you sure you want to delete this article from the space?"),
  ).toBeVisible()

  await articleConfirm.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Event has successfully been deleted!")

  // A viewer arriving after the fact reads the space as the relay now holds it
  const carol = await as(users.carol, roomPath(url, "general"))

  await expect(carol.getByText("the hull is patched")).toBeVisible()
  await expect(carol.getByText("aye captain")).toHaveCount(0)

  await carol.goto(spacePath(url) + "/articles")

  await expect(articleCard(carol, "Tides and Timetables")).toBeVisible()
  await expect(articleCard(carol, "Charting the Reef")).toHaveCount(0)
})

test("US-097 work through the action-items queue", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    // A room the relay will not admit anyone to on their own say-so, so a join request stays
    // pending instead of being granted the moment it lands.
    space.room("vault", {name: "Vault", closed: true, private: true})
    space.join(user.admin, "general", "vault")
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.profile(user.carol, {name: "Carol Cutter"})
    space.message(user.alice, "general", "the hull is patched", at(2, HOUR))
    space.message(user.alice, "general", "the sails are torn", at(90, MINUTE))
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, spacePath(url) + "/about")
  const queueButton = admin.getByRole("button", {name: /^Action Items/})

  await openSpaceMenu(admin)

  await expect(queueButton).toHaveText("Action Items (0)")
  await expect(queueButton.locator(".bg-primary")).toHaveCount(0)

  await admin.keyboard.press("Escape")

  const report = async (page: Page, text: string, reason: string) => {
    await openMessageMenu(page, text)
    await menuItem(page, "Report Content").click()

    const form = dialog(page, "Report Content")

    await form.getByRole("combobox").selectOption(reason)
    await form.getByRole("button", {name: "Send Report"}).click()

    await expect(page.getByRole("alert")).toContainText("Your report has been sent!")
  }

  const askToJoinVault = async (page: Page) => {
    await page.goto(roomPath(url, "vault"))
    await page.getByRole("button", {name: "Join Room"}).click()

    await expect(page.getByRole("button", {name: "Access Pending"})).toBeVisible()
  }

  const bob = await as(users.bob, roomPath(url, "general"))

  await expect(bob.getByText("the hull is patched")).toBeVisible()

  await report(bob, "the hull is patched", "Spam")
  await askToJoinVault(bob)

  const carol = await as(users.carol, roomPath(url, "general"))

  await expect(carol.getByText("the sails are torn")).toBeVisible()

  await report(carol, "the sails are torn", "Other")
  await askToJoinVault(carol)

  await openSpaceMenu(admin)

  await expect(queueButton).toHaveText("Action Items (4)")
  await expect(queueButton.locator(".bg-primary")).toHaveCount(1)

  await queueButton.click()

  const queue = dialog(admin, "Action Items")
  const item = (text: string, kind: string) =>
    queue.locator(".card").filter({hasText: text}).filter({hasText: kind})

  // Each report names its reporter, its reason and the message it was filed against
  const spamReport = item("Bob Barnacle", "Reported this event")

  await expect(spamReport).toContainText('as "spam"')
  await expect(spamReport).toContainText("the hull is patched")

  const otherReport = item("Carol Cutter", "Reported this event")

  await expect(otherReport).toContainText('as "other"')
  await expect(otherReport).toContainText("the sails are torn")

  // ...and each join request names its requester and the room they asked for
  const carolsRequest = item("Carol Cutter", "requested membership")
  const bobsRequest = item("Bob Barnacle", "requested membership")

  await expect(carolsRequest).toContainText("requested membership in #Vault")
  await expect(bobsRequest).toContainText("requested membership in #Vault")

  await carolsRequest.getByRole("button", {name: "Accept"}).click()

  await expect(admin.getByRole("alert")).toContainText("Member has been added to the room!")
  await expect(carolsRequest).toHaveCount(0)

  await bobsRequest.getByRole("button", {name: "Dismiss"}).click()

  await expect(admin.getByRole("alert")).toContainText("Join request has been dismissed.")
  await expect(bobsRequest).toHaveCount(0)

  // Removing content deletes the message the report was filed against...
  await spamReport.getByRole("button").first().click()
  await menuItem(admin, "Remove Content").click()

  const removal = dialog(admin, "Remove Content")

  await expect(
    removal.getByText("Are you sure you want to delete this content from the space?"),
  ).toBeVisible()

  await removal.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByRole("alert")).toContainText("Content has successfully been deleted!")
  await expect(spamReport).toHaveCount(0)

  // ...while dismissing only clears the report
  await otherReport.getByRole("button").first().click()
  await menuItem(admin, "Dismiss Report").click()

  await expect(otherReport).toHaveCount(0)

  // Accepting granted membership, dismissing did not
  await admin.goto(roomPath(url, "vault"))
  await admin.locator('[data-component="PageBar"]').getByRole("button").last().click()
  await admin.getByRole("button", {name: "View All"}).click()

  const members = dialog(admin, "Members")

  await expect(members.getByText("Carol Cutter")).toBeVisible()
  await expect(members.getByText("Bob Barnacle")).toHaveCount(0)

  // The removed message is gone from the space, the dismissed one is not
  const alice = await as(users.alice, roomPath(url, "general"))

  await expect(alice.getByText("the sails are torn")).toBeVisible()
  await expect(alice.getByText("the hull is patched")).toHaveCount(0)

  // A member never sees the queue at all
  const bobsSpace = await as(users.bob, spacePath(url) + "/about")

  await openSpaceMenu(bobsSpace)

  await expect(menuItem(bobsSpace, "Create Invite")).toBeVisible()
  await expect(bobsSpace.getByRole("button", {name: /^Action Items/})).toHaveCount(0)
})

test("US-098 browse and create hosted spaces", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    other.room("lounge", {name: "Lounge"})
    other.join(user.alice, "lounge")
  })

  const page = await as(users.alice, "/settings/hosting", {
    hosting: {plans: PLANS},
    // A space created here is opened at wss://<subdomain>.<domain>/, so the domain has to be one
    // the container serves and the subdomain has to name one of its tenants.
    env: {VITE_HOSTING_RELAY_DOMAIN: "test"},
  })

  await expect(page.getByText("You don't host any spaces yet.")).toBeVisible()
  await expect(page.getByText("Create a space to get started.")).toBeVisible()

  await page.getByRole("button", {name: "Create a Space"}).click()

  const form = dialog(page, "New Space")

  await form.getByPlaceholder("My Space").fill("Space")

  // The subdomain follows the name until it is edited
  await expect(form.getByPlaceholder("my-space")).toHaveValue("space")

  await form.getByRole("button").filter({hasText: "Up to 50 members"}).click()
  await form.getByRole("button", {name: "Create Space", exact: true}).click()

  await expect(page).toHaveURL(/\/spaces\/space\.test\/admin/)
  await expect(page.getByRole("heading", {name: "Space", exact: true})).toBeVisible()

  await page.goto("/settings/hosting")

  const listed = page.locator(".card").filter({hasText: "space.test"}).first()

  await expect(listed).toContainText("Space")
  await expect(listed).toContainText("Active")
  await expect(listed).toContainText("Free")
  await expect(listed.getByRole("link", {name: "Manage"})).toBeVisible()

  // A paid plan has to be paid for, so creation hands straight over to payment
  await page.getByRole("button", {name: "Create a Space"}).click()
  await form.getByPlaceholder("My Space").fill("Other")

  await expect(form.getByPlaceholder("my-space")).toHaveValue("other")

  await form.getByRole("button").filter({hasText: "Unlimited members"}).click()
  await form.getByRole("button", {name: "Create Space", exact: true}).click()

  await expect(page).toHaveURL(/\/spaces\/other\.test\/admin/)
  await expect(page.getByRole("heading", {name: "Set Up Payments"})).toBeVisible()
})

test("US-099 configure a hosted relay", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
  })

  const {url} = scenario.space("space")
  const relayRecord = hostedRelay({
    activity: [
      {
        id: "activity-1",
        tenant_pubkey: users.alice.pubkey,
        created_at: scenario.at(1, DAY),
        activity_type: "create_relay",
        resource_type: "relay",
        resource_id: "relay-1",
      },
    ],
  })

  const alice = await as(users.alice, spacePath(url) + "/admin", {
    hosting: {plans: PLANS, relays: [relayRecord]},
  })

  await expect(alice.getByRole("heading", {name: "Space", exact: true})).toBeVisible()
  await expect(alice.getByText("Relay created")).toBeVisible()

  await alice.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(alice, "Edit details").click()

  const editor = dialog(alice, "Edit Space")

  await editor.getByPlaceholder("My Space").fill("Harbor")
  await editor.locator("textarea").fill("Where the fleet ties up.")
  await editor.getByRole("button", {name: "Save Changes"}).click()

  await expect(alice.getByRole("heading", {name: "Harbor", exact: true})).toBeVisible()
  await expect(alice.getByText("Where the fleet ties up.")).toBeVisible()

  const publicRead = settingToggle(alice, "Public read")

  await expect(publicRead).not.toBeChecked()

  await publicRead.click()

  await expect(publicRead).toBeChecked()

  await alice.reload()

  await expect(settingToggle(alice, "Public read")).toBeChecked()

  // The free plan doesn't include either of these, and says so rather than failing on save
  const blossom = settingToggle(alice, "Media storage")

  await expect(blossom).toBeDisabled()
  await expect(settingToggle(alice, "LiveKit support")).toBeDisabled()

  // The tooltip hangs off a wrapper rather than the input, so it still shows while it is disabled
  await blossom.locator("xpath=..").hover()

  await expect(alice.getByText("Not available on your current plan").first()).toBeVisible()

  // A member of the space who doesn't own it has nothing to manage here
  const bob = await as(users.bob, spacePath(url) + "/admin")

  await expect(bob.getByRole("heading", {name: "Not a Coracle-hosted space"})).toBeVisible()
  await expect(bob.getByRole("link", {name: "Go to Hosting settings"})).toHaveAttribute(
    "href",
    "/settings/hosting",
  )
})

test("US-100 change a hosted relay's plan", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, spacePath(url) + "/admin", {
    hosting: {plans: PLANS, relays: [hostedRelay()]},
  })

  await expect(setting(page, "Current plan")).toHaveText("Free")

  await page.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(page, "Change plan").click()

  const plans = dialog(page, "Change plan")

  await plans.getByRole("button").filter({hasText: "Unlimited members"}).click()
  await plans.getByRole("button", {name: "Save", exact: true}).click()

  await expect(page.getByRole("alert")).toContainText("Plan updated.")

  // Nothing is on file to charge, so the upgrade hands over to payment setup
  await expect(page.getByRole("heading", {name: "Set Up Payments"})).toBeVisible()

  await page.getByRole("button", {name: "Set up later"}).click()

  await expect(badge(page, "Basic")).toBeVisible()
  await expect(setting(page, "Current plan")).toHaveText("Basic")

  // The paid plan unlocks both gated features
  const blossom = settingToggle(page, "Media storage")
  const livekit = settingToggle(page, "LiveKit support")

  await expect(blossom).toBeEnabled()

  await blossom.click()
  await livekit.click()

  await expect(blossom).toBeChecked()
  await expect(livekit).toBeChecked()

  await page.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(page, "Change plan").click()
  await plans.getByRole("button").filter({hasText: "Up to 50 members"}).click()
  await plans.getByRole("button", {name: "Save", exact: true}).click()

  await expect(page.getByRole("alert")).toContainText("Plan updated.")
  await expect(badge(page, "Free")).toBeVisible()
  await expect(setting(page, "Current plan")).toHaveText("Free")
  await expect(settingToggle(page, "Media storage")).not.toBeChecked()
  await expect(settingToggle(page, "LiveKit support")).not.toBeChecked()
})

test("US-101 point a custom domain at a hosted relay", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // Where the space ends up once the domain verifies, so the client has somewhere real to follow
    // it to.
    other.room("general", {name: "General"})
    other.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, spacePath(url) + "/admin", {
    hosting: {plans: PLANS, relays: [hostedRelay()]},
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  await expect(page.getByText("Not configured")).toBeVisible()

  await page.getByRole("button", {name: "Add domain"}).click()

  const domainForm = dialog(page, "Custom domain")

  await domainForm.getByPlaceholder("relay.example.com").fill("relay.other.test")
  await domainForm.getByRole("button", {name: "Save", exact: true}).click()

  await expect(page.getByRole("alert")).toContainText("Custom domain saved.")
  await expect(page.getByText("relay.other.test", {exact: true})).toBeVisible()
  await expect(page.getByText("Pending", {exact: true})).toBeVisible()
  await expect(page.getByText("relay.other.test CNAME space.test")).toBeVisible()

  // A bare domain can't take a CNAME, so it's shown as an ALIAS at the same target
  await page.getByRole("button", {name: "Manage"}).click()
  await domainForm.getByPlaceholder("relay.example.com").fill("other.test")
  await domainForm.getByRole("button", {name: "Save", exact: true}).click()

  await expect(page.getByText("other.test", {exact: true})).toBeVisible()
  await expect(page.getByText("other.test ALIAS space.test")).toBeVisible()

  await page.locator('[data-tip="Copy ALIAS target"]').click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("space.test")

  // The backend hasn't seen the record yet, so verifying says so and leaves the badge alone
  await page.getByRole("button", {name: "Verify DNS record"}).click()

  await expect(page.getByRole("alert")).toContainText(
    "Not verified yet. DNS changes can take a while to propagate.",
  )
  await expect(page.getByText("Pending", {exact: true})).toBeVisible()

  getHosting(page.context()).setRelay("relay-1", {custom_domain_verified: 1})

  await page.getByRole("button", {name: "Verify DNS record"}).click()

  await expect(page.getByRole("alert")).toContainText("Custom domain verified.")
  await expect(page.getByText("Verified", {exact: true})).toBeVisible()

  // The space is now reached through the domain its owner controls
  await expect(page.getByRole("link", {name: "wss://other.test"})).toBeVisible()
  await expect(page).toHaveURL(/\/spaces\/other\.test\/admin/)
})

test("US-102 pause a relay and settle the bill", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const paidPeriod = {start: scenario.at(2, MONTH), end: scenario.at(1, MONTH)}
  const openPeriod = {start: scenario.at(1, MONTH), end: scenario.startedAt}

  const page = await as(users.alice, spacePath(url) + "/admin", {
    hosting: {
      plans: PLANS,
      relays: [hostedRelay({plan_id: "basic"})],
      // Declared oldest first, which is not the order payment history reads in. Invoice's
      // paid_at/voided_at/method are number | null / InvoiceMethod | null upstream, so null is
      // how the hosting API spells "hasn't happened yet".
      /* eslint-disable no-restricted-syntax */
      invoices: [
        {
          id: "invoice-paid",
          tenant_pubkey: users.alice.pubkey,
          amount: 500,
          period_start: paidPeriod.start,
          period_end: paidPeriod.end,
          created_at: paidPeriod.start,
          paid_at: paidPeriod.end,
          voided_at: null,
          method: "nwc",
        },
        {
          id: "invoice-open",
          tenant_pubkey: users.alice.pubkey,
          amount: 900,
          period_start: openPeriod.start,
          period_end: openPeriod.end,
          created_at: openPeriod.start,
          paid_at: null,
          voided_at: null,
          method: null,
        },
      ],
      /* eslint-enable no-restricted-syntax */
    },
  })

  await expect(page.getByText("Active", {exact: true})).toBeVisible()

  await page.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(page, "Deactivate").click()

  const deactivate = dialog(page, "Deactivate relay?")

  await expect(deactivate.getByText(/All client connections are dropped/)).toBeVisible()

  await deactivate.getByRole("button", {name: "Confirm"}).click()

  await expect(page.getByText("Inactive", {exact: true})).toBeVisible()

  await page.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(page, "Reactivate").click()

  await dialog(page, "Reactivate relay?").getByRole("button", {name: "Confirm"}).click()

  await expect(page.getByText("Active", {exact: true})).toBeVisible()

  await page.goto("/settings/hosting")

  const banner = page.getByText(
    "You have an unpaid invoice. Pay it now to keep your relays running.",
  )

  await expect(banner).toBeVisible()

  await page.getByRole("button", {name: "Pay now"}).first().click()

  const payment = dialog(page, "Pay invoice")

  await expect(payment.getByText("$9.00")).toBeVisible()
  await expect(payment.locator("canvas")).toBeVisible()
  await expect(payment.locator("input[readonly]")).toHaveValue("lnbcinvoice-open")

  await payment.getByRole("button", {name: "Check payment"}).click()

  await expect(page.getByRole("alert")).toContainText(
    "Payment not yet confirmed. Please try again after sending.",
  )

  getHosting(page.context()).setInvoice("invoice-open", {paid_at: now(), method: "nwc"})

  await payment.getByRole("button", {name: "Check payment"}).click()

  await expect(payment.getByText("Payment confirmed!")).toBeVisible()

  await payment.getByRole("button", {name: "Done"}).click()

  await expect(banner).toHaveCount(0)

  // With the balance settled, the standing prompt is to keep it that way
  await page.getByRole("button", {name: "Set up autopay"}).click()

  const autopay = dialog(page, "Set Up Payments")

  await autopay
    .getByPlaceholder("nostr+walletconnect://")
    .fill(`nostr+walletconnect://${users.alice.pubkey}?relay=${url}&secret=abc`)
  await autopay.getByRole("button", {name: "Save", exact: true}).click()

  await expect(autopay.getByText("Wallet connected!")).toBeVisible()

  await autopay.getByRole("button", {name: "Done"}).click()

  await expect(page.getByRole("listitem").filter({hasText: "Lightning (NWC)"})).toContainText(
    "Connected",
  )

  // Payment history, newest first
  const history = page.locator(".card").filter({hasText: "Payment History"}).first()
  const invoices = history.getByRole("listitem")

  // The whole period, not just its start: the two invoices meet at a month boundary, so either
  // date on its own reads the same on both of them. Formatted by the browser rather than by node,
  // so the locale is the one the app rendered with — see dayLabel in dms.spec.ts.
  const period = ({start, end}: {start: number; end: number}) =>
    page.evaluate(
      ([from, to]) =>
        `${new Date(from * 1000).toLocaleDateString()} – ${new Date(to * 1000).toLocaleDateString()}`,
      [start, end],
    )

  await expect(invoices.first()).toContainText("$9.00")
  await expect(invoices.first()).toContainText(await period(openPeriod))
  await expect(invoices.nth(1)).toContainText("$5.00")
  await expect(invoices.nth(1)).toContainText(await period(paidPeriod))
})

test("US-122 export and import a hosted relay's data", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const dump = '{"id":"a","sig":"a"}\n{"id":"b","sig":"b"}\n'
  const page = await as(users.alice, spacePath(url) + "/admin", {
    hosting: {plans: PLANS, relays: [hostedRelay({events: dump})]},
  })

  await page.getByRole("button", {name: "Relay actions"}).click()
  await menuItem(page, "Import / export data").click()

  const modal = dialog(page, "Relay data")
  const download = page.waitForEvent("download")

  await modal.getByRole("button", {name: "Download events"}).click()

  expect((await download).suggestedFilename()).toBe("space.jsonl")

  await modal.locator("input[type=file]").setInputFiles({
    name: "events.jsonl",
    mimeType: "application/x-ndjson",
    buffer: Buffer.from('{"id":"c","sig":"c"}\nnot an event\n'),
  })

  await modal.getByRole("button", {name: "Import events"}).click()

  // The relay keeps what it could verify and says which line it refused
  await expect(modal.getByText("Imported 1 event, skipped 1.")).toBeVisible()
  await expect(modal.getByText("line 2: invalid event")).toBeVisible()
})
