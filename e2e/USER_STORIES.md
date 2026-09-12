# Flotilla user stories

The catalog e2e specs are written from. Each story is a slice of behavior a
person can observe in the running app. Specs reference stories by stable
id (`US-042`), so numbers are never reused or renumbered.

A story is behavior someone can describe without reading the css: what a button
does, what a feed contains, what a notification says. A layout threshold, a
padding, a color or a wording is not one, and a change that only moves one
belongs in the acceptance text of the story it sits under rather than in a story
of its own. Nothing in CI runs this suite, so every spec is a cost paid by hand
forever.

**Personas** come from `e2e/harness/keys.ts`, which defines four deterministic
identities:

- **alice**, **bob**, **carol** — ordinary members. Multi-user stories give each
  their own browser context against the same relay, so one genuinely observes
  another's writes over the wire.
- **admin** — the space admin, recognized by the relay's NIP-86 answers, which
  is what unlocks the space, room, event and directory management surfaces.

The test architecture is described in `e2e/ARCHITECTURE.md`: real zooid relays in
docker, with every socket and http request terminated in the test process.
Services with a mock seam are mocked per scenario. Features that live past a
boundary with no seam are listed under "Out of scope" below.

## Onboarding & authentication

### US-001 — Sign-in gate for logged-out visitors

As a first-time visitor, I want a clear log-in-or-sign-up screen wherever I
land, so that I know an identity is required before I can use anything.

Acceptance:

- Visiting any url while logged out shows a "Welcome" modal offering "Log in"
  and "Create an account", with links to the terms of service and privacy
  policy.
- The modal cannot be dismissed with escape or by clicking outside it.
- Each button opens its respective flow.

### US-002 — Sign up by generating a new key

As a new user with no nostr identity, I want to create a profile and generate a
key in the app, so that I can start participating without an external tool.

Acceptance:

- Entering a display name advances to a key-backup step whose "Continue" button
  stays disabled until a key file has been downloaded.
- Choosing the encrypted download requires a password of at least 12 characters
  and produces a file containing an ncryptsec rather than a plain nsec.
- Finishing the flow logs the new user in, dismisses the dialog, and lands on
  the dashboard with the platform's default space visible.
- The display name entered during signup appears on the new user's own profile.

### US-003 — Log in with an existing private key

As a returning user holding my own key, I want to paste it to log in, so that I
don't need an extension or signer app.

Acceptance:

- Pasting alice's nsec logs her in as her own pubkey; pasting the equivalent
  64-character hex key behaves identically.
- Pasting an ncryptsec reveals a password field: the correct password logs in, a
  wrong one shows an error and stays logged out.
- Text that is not a valid key leaves the submit button disabled.
- bob logging in with his own key in a separate context sees his own identity,
  not alice's.

### US-004 — Log in with a browser extension

As a user with a NIP-07 extension, I want to log in with one click, so that my
key never reaches the app.

Acceptance:

- With a NIP-07 provider present, the log-in screen offers "Log in with
  Extension".
- Clicking it logs the user in as the pubkey the extension returns, without ever
  displaying a private key.
- With no provider present, the button is absent.

### US-005 — Log in with a remote signer

As a security-conscious user, I want to connect a remote signer by pasting a
bunker link, so that my key stays on another device.

Acceptance:

- A bunker link with no signer pubkey is rejected with an "invalid bunker link"
  message and no connection attempt.
- A bunker link carrying no relays is rejected with a message naming that as the
  reason.
- Switching to "Log in with a QR code instead" shows a connection code view, and
  "Go back" returns to the link input.

### US-006 — Stay logged in, and log out deliberately

As a logged-in user, I want the app to remember me across reloads and to confirm
before logging out, so that I neither re-authenticate constantly nor lose local
data by accident.

Acceptance:

- After logging in and reloading, alice is still logged in and the sign-in gate
  does not reappear; her spaces and settings are still hers.
- "Log Out" opens a confirmation warning that the local database will be
  cleared, and "Go back" leaves her logged in.
- Confirming clears her session and returns her to the sign-in gate.

### US-007 — Inspect your keys and signer status

As a logged-in user, I want to see my keys and how my signer is behaving, so
that I can back up my identity and tell whether requests are succeeding.

Acceptance:

- Settings › Profile shows alice's npub in a read-only field whose copy button
  puts it on the clipboard.
- A session logged in with a raw key also shows a masked nsec field with its own
  copy button; an extension or remote-signer session shows no private key at
  all.
- A signer status card names the login method and reports "Ok", and its
  succeeded-request count increases after an action that requires a signature.

### US-008 — Delete your nostr account

As a user leaving the network, I want a guarded way to delete my account
everywhere, so that I can't do it by accident and I understand it is final.

Acceptance:

- Settings › Profile › Advanced › "Delete your profile" opens a dialog whose
  submit stays disabled until the exact confirmation phrase is typed.
- Confirming shows a progress indicator while deletion requests publish, then
  logs alice out and returns her to the sign-in gate.
- bob viewing alice's profile afterward sees her name blanked out.

## Spaces

### US-009 — Browse, search, and reorder your spaces

As alice, I want to see the spaces I've joined and find new ones, so that I can
get where I'm going and discover communities.

Acceptance:

- `/spaces` shows a "Your spaces" section listing every space alice has joined
  and a "Browse Spaces" section of the rest.
- Typing a term filters both sections live, matching name, url, or description.
- Clicking a joined space opens it; clicking one she hasn't joined opens a join
  prompt instead.
- Dragging a joined space above another, on the page or in the sidebar rail,
  reorders the list immediately, and the order survives a reload.

### US-010 — Join a space from an invite link

As alice, I want to paste an invite link or relay url to join a space, so that I
can start participating without already being a member.

Acceptance:

- "Add Space" › "Join a space" accepts a valid invite link and shows a preview
  of the space before she confirms.
- Confirming joins the space, shows a welcome message, and takes her into it.
- An unparseable link leaves the join button disabled and shows no preview.
- Navigating directly to the url of a space she hasn't joined opens the same
  join prompt automatically, and going back leaves her un-joined.

### US-011 — Request access when a space turns you away

As alice, I want a way forward when a space refuses my join, so that a code or
an appeal can still get me in.

Acceptance:

- A space that requires an invite code shows a "Request Access" state instead of
  joining her; a correct code grants access and an incorrect one shows an error
  without joining her.
- When admin has banned bob and he revisits a space he belongs to, he sees an
  access-error modal quoting the relay's reason.
- From that modal bob can leave the space, which removes it from his list, or
  open the same invite-code request flow.

### US-012 — Decide whether to trust an unsigned space

As alice, I want a warning before using a space whose operator can forge
messages, so that I can decide whether it is safe.

Acceptance:

- Opening a space that publishes no signatures shows a "Do you trust this
  space?" prompt before she can use it.
- Trusting it dismisses the prompt and lets her continue.
- Declining removes the space from her joined spaces and returns her home.

### US-013 — Follow a space that has moved

As alice, I want to be told when a space changes address, so that I keep talking
to the right relay.

Acceptance:

- A relay reporting a new address shows a "This space has moved" modal naming
  both addresses.
- Confirming updates her space list to the new url and takes her there.
- "Not now" leaves her on the old address.

### US-014 — Leave a space

As bob, I want to leave a space I've lost interest in, so that it stops
cluttering my list.

Acceptance:

- "Leave Space" from the space menu asks for confirmation.
- Confirming removes the space from `/spaces` and returns him to the home
  screen.
- He can rejoin later from search or an invite link.

### US-015 — View a space's details

As carol, I want to read a space's public information, so that I can size it up
before or after joining.

Acceptance:

- The About page shows the space's icon, name, url, description, and any
  terms-of-service or privacy-policy links.
- Administrator, contact, software, and version badges appear when the relay
  reports them, and auth-required, payment-required, or proof-of-work warnings
  appear when they apply.
- A members summary listing admins and newest members links through to the full
  directory.
- Content admin has featured renders at the top for every visitor.

### US-017 — Search across a space

As alice, I want to search a whole space at once, so that I can find something
when I don't remember which room it was in.

Acceptance:

- Typing a term returns matches from more than one room, grouped into Last 24
  Hours / Last 7 Days / Older, each labeled with the room it came from.
- Clicking a result navigates into that room at the matching message.
- A term with no matches shows a "No results found" state.

## Rooms & chat

### US-018 — Send and receive a room message in real time

As alice, I want to send a message and have bob see it appear live, so that we
can actually hold a conversation.

Acceptance:

- Typing in the composer and pressing Enter sends the message, clears the
  composer, and shows it at the bottom of the timeline with alice's name,
  avatar, and timestamp.
- Shift+Enter inserts a newline instead of sending, and Cmd/Ctrl+Enter sends
  from mid-line.
- bob, already viewing the same room in his own session, sees the message appear
  without reloading.

### US-118 — Messages sent in the same second are in one order for everyone

As alice, I want a room to read the same way for me as it does for bob, so that
we can refer to what was said without first agreeing on what order it was in.

Acceptance:

- Five messages sharing one timestamp are shown in ascending event id order,
  whatever order they reached the client in.

### US-019 — Join and leave a room

As bob, I want to join a room's member list and leave it later, so that it shows
up among my rooms only while I care about it.

Acceptance:

- Clicking "Join Room" moves the room under "Your Rooms" in his sidebar.
- Other members see a centered "<name> joined the room" line in the timeline,
  linking to his profile.
- "Leave member list" from the room menu confirms with a toast and the room is
  no longer marked as joined.

### US-020 — Create, edit, and delete a room

As admin, I want to add a room, adjust its settings later, and remove it when
it's done, so that the space's structure matches how people actually use it.

Acceptance:

- Creating a room with a name and description navigates admin into it and lists
  it under "Your Rooms".
- Editing the room's name and toggling "Only allow members to read messages"
  updates the header and sidebar, and the detail panel shows a "Private" badge;
  reopening the edit form shows the toggles as saved.
- Deleting the room after confirming returns admin to the space's default view
  and removes it from the sidebar.
- bob sees neither "Edit Room" nor "Delete Room" in the room's detail menu.

### US-121 — Land somewhere after deleting the room you are in

As admin, I want deleting the room I am reading to put me on a page of the
space, so that I am not stranded on a screen with nothing on it.

Acceptance:

- Confirming the deletion leaves admin on a page below the space root, with the
  space's remaining rooms listed beside it.
- Entering the space again from the rail lands on a page, rather than returning
  to the room that was deleted or to the empty root.

### US-021 — Request access to a private room and get approved

As carol, I want to ask to join a closed room and be let in, so that I can read
and post there.

Acceptance:

- Opening the private room shows a "not a member" message instead of history,
  with an "Ask to Join" button.
- After she requests access, her button shows a pending state.
- Once admin accepts the request, carol can read the room's messages and send
  her own.

### US-022 — Bring people into a room

As admin, I want to invite people to a specific room or add them directly, so
that I can populate a closed room without waiting on requests.

Acceptance:

- "Create invite" shows a QR code and a copyable invite url; copying confirms,
  and opening that link as carol lands her in the right space and room with a
  join option.
- The room's member list shows every current member; searching for and adding
  someone shows a success toast and lists them, and adding a person who isn't a
  space member offers to add them to the space too.
- Removing a member after confirming takes them off the list.
- bob viewing the same member list sees no "Add members" control.

### US-023 — Reply to a message

As bob, I want to reply to alice's message directly, so that my response is
clearly attached to what she said.

Acceptance:

- Clicking reply shows a "Replying to alice" banner quoting her message above
  the composer.
- Sending posts a reply that renders her original as an embedded quote for
  everyone in the room.
- Dismissing the banner with its close button or Escape clears the reply without
  sending.

### US-024 — Edit or delete a message you sent

As alice, I want to fix or retract a message I just sent, so that the room shows
what I meant.

Acceptance:

- Alice's own recent message offers edit and delete; bob's message offers her
  neither.
- Editing pre-fills the composer with an "Editing message" banner, and
  submitting replaces the text in place, at its original position, for bob as
  well.
- Pressing the up arrow in an empty composer opens her most recent editable
  message; closing the banner cancels without changing anything.
- Deleting after confirming removes the message from both alice's and bob's view
  of the room.

### US-025 — React to a message

As carol, I want to react with an emoji, so that I can respond without writing a
message.

Acceptance:

- The quick reaction button opens an emoji picker, and choosing one adds a
  reaction pill under the message for everyone in the room.
- When bob and carol react with the same emoji it shows as one pill with a count
  of 2.
- Clicking her own reaction again removes it.
- On a narrow viewport, tapping a pill she hasn't joined shows the list of
  reactors instead of adding her own.

### US-026 — Pin a message and browse pins

As admin, I want to pin key messages, so that important information stays
findable.

Acceptance:

- "Pin Message" confirms with a toast and raises a pinned banner at the top of
  the room showing the message.
- "View all pinned" lists the message with a working "Jump to message".
- Unpinning from that list removes both the entry and the banner.

### US-027 — Find a past message and jump to it

As a room member, I want to search a room and follow message links, so that I
can get back to something without scrolling.

Acceptance:

- Room search returns matching messages grouped into Last 24 Hours / Last 7 Days
  / Older, and a term with no matches shows "No results found".
- Clicking a result closes search and scrolls the timeline to the message,
  highlighted in view.
- Opening a permalink url for a specific message lands on that message directly,
  and in a room short enough that the window opening with it reaches the present,
  there is nothing left to jump back to and no control.

### US-027a — Follow a link to a recent message

As someone opening a push notification, I want the room to behave as though I
had scrolled to the bottom, so that I am not offered a way back to where I
already am.

Acceptance:

- A permalink to a message near the newest end lands with the room's last
  message on screen and no "jump to newest" control, even when other events were
  published after the one linked to.

### US-028 — Share a message somewhere else

As alice, I want to forward a message into another room in the same space, so
that I can pass it along without retyping it.

Acceptance:

- "Share" on a message inside a space opens a picker of that space's rooms.
- Choosing a destination navigates there with the composer pre-filled with a
  quote of the shared message.
- Sending posts the quoted message in the destination, visible to bob there.

### US-119 — Have a message read out loud

As alice, I want a message read to me, so that I can take in what was said
without looking at the screen.

Acceptance:

- "Read Out Loud" on a message with no OpenRouter key saved asks for one, the
  same prompt dictation uses.
- Once a key is saved, the same menu item puts a player at the bottom of the
  app naming whose message is being read.
- A quote, a mention or a url in the message is named rather than spelled out.
- The player starts on its own, pauses, scrubs, and closes, and closing it takes
  it away.

### US-115 — Connect a wallet while sending a zap

As alice, I want to connect a wallet from the zap dialog and go on zapping, so
that reaching for one mid-zap is not a dead end.

Acceptance:

- Zapping a message from someone with a lightning address offers "Create
  invoice" and a prompt to connect a wallet.
- Connecting one over WebLN reports success and closes only the wallet dialog.
- The zap dialog behind it drops the prompt, offers "Send Zap" instead, and
  still holds the amount that was typed before the detour.

## Direct messages

### US-029 — Start a one-on-one chat

As alice, I want to start a private conversation by searching for someone, so
that I can message them directly.

Acceptance:

- "Start New Chat" suggests bob as she types his name, and selecting him plus
  "Create Chat" opens a conversation with a usable composer.
- The conversation appears at the top of her list, labeled with bob's name.
- Bob's profile page offers a "Message" button that opens the same conversation;
  her own profile offers none.
- A profile modal has no such button, so its "..." menu offers "Send Message"
  instead; the profile page's menu does not repeat it.

### US-030 — Start a group chat

As alice, I want to message several people at once, so that we can all talk in
one place.

Acceptance:

- Selecting both bob and carol in the start-a-chat dialog opens a single
  conversation containing both.
- The header shows a combined label rather than one name.
- Opening the conversation's member list shows both participants, and clicking
  one opens their profile.

### US-031 — Direct messaging has to be switched on

As alice, I want to be told when messaging isn't set up — mine or my recipient's
— so that I understand why a conversation looks stuck.

Acceptance:

- Entering chat before ever enabling DMs shows an "Enable direct messaging?"
  dialog instead of the chat UI; enabling proceeds to the flow she started and
  the prompt does not return.
- Opening a conversation with bob, who has never enabled DMs, shows a banner
  naming him and leaves the composer disabled.
- After bob enables DMs and alice reopens the conversation, the banner is gone
  and the composer works.

### US-032 — Exchange messages in a conversation

As alice, I want to send messages to bob and read the thread easily, so that we
can hold a conversation.

Acceptance:

- Sending adds the message to alice's thread immediately, attributed to her, and
  clears the composer.
- The message appears in bob's already-open conversation without a reload.
- Messages render chronologically with a date divider between days, and
  consecutive messages from the same sender show the name and avatar once rather
  than on each.

### US-033 — Browse and search your conversations

As alice, I want all my conversations in one list I can filter, so that I can
find the right one fast.

Acceptance:

- The chat list shows every conversation, most recently active first, each with
  participant names, a last-message preview, and a timestamp.
- Typing bob's name narrows the list to conversations involving him, and
  clearing it restores the full list.

### US-034 — Track and clear unread conversations

As alice, I want unread conversations to stand out and be clearable in bulk, so
that I always know what's new without opening everything.

Acceptance:

- A message bob sends while alice is elsewhere marks that conversation unread in
  her list.
- Visiting the conversation and navigating away clears its indicator.
- "Mark all read" from the chat menu clears every conversation's indicator at
  once, and they stay clear on return.

### US-035 — Reply to, edit, and react to a direct message

As alice, I want the same message-level actions in chat as in rooms, so that
conversations are as expressive as rooms are.

Acceptance:

- Choosing reply on bob's message shows a preview above the composer, and the
  sent reply visibly quotes his message; the preview's close button clears it
  without sending.
- "Edit Message" on alice's own recent message loads it into the composer with
  an editing indicator, and submitting replaces that message's content for both
  of them rather than adding a new one; pressing up in an empty composer starts
  editing her most recent message.
- Choosing an emoji from the reaction picker shows the reaction under the
  message for both, and clicking her own reaction again removes it.

### US-036 — Receive a new conversation live

As alice, I want a conversation someone starts with me to appear on its own, so
that I never miss a first message.

Acceptance:

- With alice's chat list open and bob starting a new chat from his own session,
  a conversation with bob appears in her list without a reload.
- Opening it shows his message.

### US-108 — Read messages from a relay you only use for messages

As alice, I want the conversations on my messaging relay to load even when that relay is not one
of my spaces, so that direct messages work wherever I have pointed them.

Acceptance:

- With alice's messaging relays naming a relay she has not joined and neither reads from nor
  publishes to, a conversation held there still appears in her chat list and opens with its
  history.
- That relay hands her messages to nobody but her, so her messaging relay list is the only thing
  that can vouch for her to it.
- A messaging relay list written by another client, naming the same relay without the trailing
  slash, is honoured the same way.

### US-109 — Keep a conversation I have already read

As alice, I want a conversation I have already read to stay readable, so that my history does not
shrink to whatever my messaging relays happen to still be holding.

Acceptance:

- With a conversation open and read, closing the app and opening it again shows the same messages,
  whether or not the relay they arrived from still serves them.
- A message deleted or edited out of that conversation stays gone across the same restart.
- A reaction I left on one of its messages is still there after the same restart.

## Articles & threads

### US-037 — Write and publish an article

As alice, I want to publish a long-form article to a space, so that members can
read something longer than a chat message.

Acceptance:

- Submitting with no title, or with a title and no body, shows an error toast
  and publishes nothing.
- Publishing a complete article closes the modal and puts it at the top of the
  space's Articles list.
- Closing the composer without publishing preserves the entered title and body
  when it is reopened; after a successful publish the composer starts blank.

### US-038 — Browse, filter, and read articles

As bob, I want to narrow a space's articles and read one in full, so that I can
find and consume what interests me.

Acceptance:

- The Articles page lists each article with its author, published date, and a
  preview; clicking an author or a topic filters the list, and combining both
  narrows to articles matching both.
- An article with more topics than fit on one line wraps them inside its card
  rather than pushing its reactions and action menu off the edge.
- Opening an article shows its title, cover image, summary, published date, and
  full content, with the title matching its list card.
- Markdown in the body renders as real headings, bold text, and bullet lists,
  and a raw npub reference renders as an "@displayname" link.

### US-039 — Comment on an article

As bob and carol, we want to comment on an article and reply to each other, so
that we can discuss it under the piece itself.

Acceptance:

- Bob's comment on alice's article appears listed under it.
- Carol's reply to bob renders nested beneath his comment rather than as a
  top-level comment.
- Alice sees both and can add her own comment at the root, optionally attaching
  an image to it.
- Every comment on an article posted in a room is tagged into that room, so the
  relay handles it as part of the group.

### US-040 — React to a post with an emoji

As bob, I want to react to articles, comments, thread posts, and notes, so that
I can respond without writing.

Acceptance:

- Clicking an emoji on an article records bob's reaction with a count of 1,
  highlighted as his own.
- Clicking the same emoji again removes it and the count returns to 0.
- The same behavior applies to a comment on the article, to a post inside a
  thread, and to a note on someone's profile.

### US-041 — Publish an article from a room

As alice, I want an article I write inside a room to be announced there, so that
the room sees it without me posting a second time.

Acceptance:

- Publishing from a room's compose menu posts a quote of the new article into
  that room's chat.
- The article's detail page and list card show a "Posted in #room" badge.
- Clicking that badge navigates to the room it names.

### US-042 — Start a thread and see it filed under its room

As alice, I want threads grouped by the room they belong to, so that the Threads
page stays organized.

Acceptance:

- Creating a thread from a room's compose menu files it under that room's board
  and posts a quote of it into the room's chat.
- Each board on the Threads page has its own create button, and a thread started
  from it is filed under that board.
- The "General" board is always present, so a thread belonging to no room can be
  started from the Threads page.
- Each board row shows the topic title, author, reply count, and last-post time.

### US-043 — Reply to a thread and to a specific post

As bob and carol, we want to answer a thread as a whole or one post inside it,
so that responses connect to the right thing.

Acceptance:

- "Reply to thread" opens a composer with no quoted parent, and submitting
  appends a post and increments the reply count in the header.
- "Reply" on a single post shows "Replying to" that post, which can be cleared
  before submitting.
- A reply to a thread in a room is tagged into that room, so the relay handles
  it as part of the group.
- The thread's opening post carries an "OP" badge on every page.

### US-044 — Navigate a long thread

As bob, I want a long thread paginated and its posts individually linkable, so
that I can move around it and point people at one message.

Acceptance:

- A thread with more than 20 posts shows pagination controls, and the page
  number, next/prev, and first/last controls each move to the matching slice
  with the "Page X of Y" indicator updating.
- "Permalink" on a post copies a link to that post.
- Opening that link as carol loads the thread, navigates to the page holding
  that post, and scrolls it into view.

### US-045 — Turn a chat message into a thread

As bob, I want to promote an interesting message to a thread, so that the
discussion can continue somewhere more structured.

Acceptance:

- "Create a Thread" from a room message's menu opens the thread composer
  pre-filled with a quote of that message.
- Publishing files the thread under that room's board.
- The message it was created from carries a link to the thread, which opens it.
- Opening the thread shows the quoted original message as part of the opening
  post.

## Community features

### US-046 — Create and browse a calendar event

As alice, I want to put an event on the space's calendar, so that members can
see when it is happening.

Acceptance:

- The create form requires a title and a start/end time.
- Submitting closes the modal and lists the event under its date on the Calendar
  page.
- The calendar opens scrolled to today or the next upcoming event.

### US-047 — Manage your own calendar event

As alice, I want to correct or cancel an event I created, so that the calendar
stays accurate.

Acceptance:

- Clicking an event opens a detail page showing title, date, location, and host.
- As the author, alice sees Edit, which pre-fills the form; saving updates the
  detail page.
- Deleting the event after confirming removes it from the calendar list.

### US-048 — Create a poll and vote on it

As alice, I want to run a poll, so that the room can decide something together.

Acceptance:

- Creating a poll requires a question and at least two options, which can be
  reordered by dragging.
- Selecting an option casts alice's vote and updates that option's count and
  progress bar.
- bob, in a separate session, sees alice's vote reflected and his own vote
  appears in her view without a reload.
- On a multiple-choice poll, two options can be selected together and both
  publish once the delay elapses; unchecking one before then keeps it out of the
  vote.

### US-049 — A closed poll shows final results only

As alice, I want a poll past its end time to stop taking votes, so that the
outcome is unambiguous.

Acceptance:

- A poll whose end date has passed shows "Ended" with the time, in place of
  voting controls.
- Counts and progress bars still render from the votes already cast.
- No radio or checkbox inputs appear on its options.

### US-050 — Create a funding goal and track its progress

As alice, I want to raise money for a purpose and show how it's going, so that
members can see the momentum.

Acceptance:

- Creating a goal requires a title and details; the sats target defaults to 1000
  and can be set by field or slider.
- The goal's detail page shows the amount funded against its target on a
  progress bar.
- A goal with contributions shows a contributor count and how long it has been
  running.

### US-051 — Post, edit, and close out a classified listing

As alice, I want to list something for sale and mark it sold when it's gone, so
that nobody chases a listing that's finished.

Acceptance:

- Creating a listing requires a title and description; price defaults to 0 with
  a selectable currency, images attach, and topics come from a multi-select.
- The listing appears in the Classifieds list with its title and price.
- Editing pre-fills the form with current values, and saving with status "Sold"
  shows a Sold badge on both the listing's detail page and its list item.

### US-052 — Comment on and react to community posts

As bob, I want to react and comment on events, polls, and goals, so that I can
register interest and ask questions.

Acceptance:

- Adding an emoji reaction to alice's calendar event records it under his name.
- His comment appears in the replies thread on the event, and alice sees it.
- With more than four replies, a "show all" control expands the rest.

### US-053 — Browse and search the library

As alice, I want to search curated links and open a shelf, so that I can find
resources members have collected.

Acceptance:

- Typing a term filters the shelf list to shelves whose title, description, or
  topics match.
- Selecting a shelf shows its pins as a gallery; an empty shelf shows a message
  instead.
- As a non-admin, alice sees no "Create Shelf" or "Add a link" controls.

### US-054 — Curate the library

As admin, I want to organize shelves and the links on them, so that members find
good material first.

Acceptance:

- Creating a shelf with a title and description adds it to the list and
  navigates into it; editing and deleting it from its menu update the list.
- Adding a pin with an external url shows it as a content card, and adding one
  with a nostr note link renders that note as a rich embed.
- "Add to Library" on a post (for example a poll) with a shelf selected adds it
  as a pin visible in that shelf; with no shelves yet, the dialog prompts to
  create one.

### US-055 — Create community content from a room

As alice, I want to start a poll, event, goal, or listing straight from the room
composer, so that the room sees it immediately.

Acceptance:

- The composer's "+" menu lists the content types that can be created and shared
  into the room.
- Choosing one opens its creation form, and submitting posts a quoted link to
  the new item into the room.
- Clicking that quote navigates to the item's detail page.

## Composer & media

### US-056 — Autocomplete a mention or a room reference

As alice, I want to pull people and rooms into a message as I type, so that
readers can follow them.

Acceptance:

- Typing "@" plus a few letters opens a dropdown of matching profiles, ranking
  room and space members first, and narrowing as she types.
- Selecting bob inserts a mention that renders his name in the composer and in
  the sent message.
- Typing "~" opens a list of rooms; selecting one inserts a reference that
  renders as a clickable link once sent.

### US-057 — Attach and send an image

As alice, I want to put a picture in a message, so that I can share something
visual.

Acceptance:

- Choosing an image from the upload button shows a spinner and disables sending
  until the upload finishes.
- After sending, the image renders inline in the timeline for bob as well; a DM
  behaves the same for its recipient.
- Dropping an image onto the composer, or pasting one from the clipboard,
  attaches it the same way.
- A file the editor has no node for attaches as a link instead. What the server
  refuses attaches nothing and shows its reason in an error toast.

### US-058 — Drafts survive navigating away

As alice, I want an unsent message to still be there when I come back, so that I
don't lose what I was writing.

Acceptance:

- Typing partial text in a room, navigating to another room, and returning shows
  the text still in the composer.
- The same holds for a conversation in chat.
- Sending the message clears its draft, so the composer is empty on the next
  visit.

### US-059 — Cancel a reply or edit in progress

As alice, I want to back out of a reply or an edit cleanly, so that a false
start doesn't get published.

Acceptance:

- The reply banner and the "Editing message" banner each close via their X or
  Escape.
- Dismissing leaves the original message unchanged and sends nothing.
- The composer returns to composing a new message with its previous draft
  intact.

## Rich content & media rendering

### US-060 — Reveal a flagged sensitive message

As alice, I want a warning before flagged content is shown, so that I can choose
whether to look.

Acceptance:

- A message bob tags with a content warning renders as a card naming the reason,
  with a "Show anyway" button, in place of his text.
- Clicking "Show anyway" reveals his message content in the same spot.

### US-061 — Expand a long post

As carol, I want long posts truncated with a way to read the rest, so that one
post doesn't take the whole screen.

Acceptance:

- A post past the truncation threshold renders cut short with a "Read more"
  control instead of the full text.
- Clicking it reveals the full text in place, without navigating anywhere.

### US-062 — See images and video inline

As alice, I want shared media to play and display where it was posted, so that I
don't have to open links.

Acceptance:

- A message that is only an image url renders the image inline rather than as a
  link.
- Tapping the image opens a fullscreen lightbox, and tapping it again (or going
  back) returns to the room.
- A message that is only a video url renders an embedded player with visible
  controls.

### US-063 — Preview a shared link

As alice, I want a link shared on its own to expand into a preview while a link
mid-sentence stays small, so that the timeline reads well either way.

Acceptance:

- A standalone url whose preview resolves shows a card with title, description,
  and image after a brief loading state.
- A standalone url with nothing usable falls back to the compact inline link.
- The same url embedded in a sentence renders as a compact inline link with no
  card.

### US-064 — Follow a link to another space

As alice, I want a link to one of this app's own spaces to be recognized, so
that it takes me there instead of out of the app.

Acceptance:

- A message containing the relay url of a second space renders as a named
  reference to that space rather than a raw url.
- Clicking it navigates into that space in the app, with no new tab opened.

### US-065 — See quoted and embedded content

As alice, I want quoted messages and posts rendered in place, so that I can
follow context and jump to the original.

Acceptance:

- Bob's reply to alice shows her original message embedded as a compact bordered
  quote strip.
- Clicking that strip takes alice to (or scrolls her to) her original message.
- A room message quoting a thread post renders as a bordered card naming the
  author and content, briefly showing a loading state first.
- Clicking that card opens the quoted post.

### US-066 — See distinctive inline tokens

As alice, I want hashtags, mentions, emoji, code, and addresses to look
different from prose, so that a message's structure is readable at a glance.

Acceptance:

- A "#hashtag" renders with distinct highlighting, and a registered custom emoji
  shortcode renders as a small inline image instead of the raw text.
- Single-backtick text renders as an inline monospace snippet and a fenced block
  renders as a full-width code block.
- A mention renders as a clickable "@displayname" that opens that person's
  profile, and a plain email address renders as a mailto link.

### US-067 — Copy a shared invoice or token

As alice, I want a Lightning invoice or Cashu token in chat to be copyable
rather than a wall of text, so that I can use it elsewhere.

Acceptance:

- A message containing a bolt11 invoice renders as a compact chip with an icon
  and truncated value.
- Tapping the chip copies the full string and shows a "Copied to clipboard!"
  toast.
- A cashu token renders and copies the same way.

## Message delivery & reliability

### US-068 — Watch a delayed send, and cancel it

As alice, I want a window to take a message back before it leaves, so that I can
catch a mistake.

Acceptance:

- With a send delay configured in settings, sending a room message shows the
  bubble immediately with a "Sending..." label; once the relay confirms, the
  label clears and a "Message sent!" toast appears and dismisses itself.
- With the delay at 0, the message publishes immediately with no confirmation
  toast.
- Clicking Cancel during the delay removes the message from alice's own view,
  and bob never sees it even after the delay window passes.
- The same cancel works on a direct message, which never reaches bob's thread.

### US-069 — See why a message failed to deliver

As alice, I want a failed send flagged with the relay and the reason, so that I
understand what went wrong.

Acceptance:

- A message the relay rejects shows "Failed to send!" beneath its bubble once
  publishing completes, with the text still visible to alice and never visible
  to bob.
- Tapping the indicator opens a popover listing each target relay with a success
  or failure icon and a rejection reason, falling back to "request timed out" or
  "no details received".
- A DM that reaches one of bob's messaging relays but not the other shows
  "Partial delivery 1/2 relays" with one green check and one failure and reason.

### US-070 — Retry a failed relay

As alice, I want to retry only the relay that failed, so that I don't resend the
whole message.

Acceptance:

- Retry beside a failed relay re-publishes to that relay alone.
- For a chat message, a "Sending..." toast appears and becomes "Message sent!"
  once the relay confirms; a failed retry leaves no success message and can be
  retried again.
- For an article or comment, a successful retry clears the "Failed to send!"
  indicator and restores the normal reaction and menu actions, with no toast.

### US-071 — Content posts show delivery status in place

As alice, I want articles and comments to report their status where they sit, so
that publishing feels the same as chatting without a popup.

Acceptance:

- A newly submitted article, thread, comment, poll, goal, event, or listing
  shows "Sending..." with a Cancel link in its actions row until the relay
  confirms.
- On confirmation the status disappears silently and the normal reaction and
  menu actions take its place.
- Cancelling removes the post entirely from the list or thread it was posted
  into, and bob never sees it.
- A failed post shows "Failed to send!" in the same row, opening the same
  per-relay detail popover.

### US-072 — A deleted post is marked deleted

As alice, I want a post I deleted to read as deleted, so that it isn't confused
with one still sending.

Acceptance:

- After alice deletes her own comment, article, thread, poll, goal, event, or
  listing, its row shows a "Deleted" pill.
- The pill replaces the reaction summary and menu actions.
- It takes priority over any pending or failed send status that would otherwise
  show.

### US-073 — A multi-part message reports one status

As alice, I want a message with text and an image to show a single status, so
that one send doesn't look like two.

Acceptance:

- Sending a DM with both a text portion and an image shows one "Sending..."
  toast, not two.
- It becomes "Message sent!" only once both parts have reached every relay.
- Each resulting bubble still carries its own failure indicator if that part
  fails.

## People & social

### US-074 — Find a person

As alice, I want to search for people by name, so that I can get to someone's
profile.

Acceptance:

- Typing a name in the search dialog filters results as she types, each showing
  avatar, display name, and about text.
- Only the ten best matches are listed.
- Clicking a result opens that person's profile.

### US-075 — View someone's profile

As alice, I want to see bob's public identity in one place, so that I know who
I'm dealing with.

Acceptance:

- His profile shows display name, avatar, banner, about text, and a shortened
  npub whose copy button confirms the copy.
- A status he has published shows what he is up to, and links to the url it
  names; an expired one shows nothing.
- A website he has set renders as a link.
- A Spaces panel lists the spaces he belongs to with a count, marks any alice
  also belongs to as "Member", and navigates to a space when clicked; with none,
  it shows an empty state.

### US-076 — Follow and unfollow

As alice, I want to follow and unfollow bob from his profile, so that I control
who I keep up with.

Acceptance:

- His profile shows "Follow" while she doesn't follow him.
- Clicking it switches to "Unfollow" without a reload.
- Clicking "Unfollow" switches it back.

### US-077 — See web-of-trust standing build up

As alice, I want to see how known someone is in my network, so that I can judge
whether to engage.

Acceptance:

- Before anyone she follows follows bob, his reputation panel shows a low score
  and "not well known in your network".
- After alice follows carol and carol follows bob, his profile reads "Followed
  by 1+ people in your network" and lists carol.
- The trust ring shown beside his name elsewhere in the app fills in further
  than before.

### US-078 — Edit your own profile

As alice, I want to update my name, bio, and pictures, so that people see my
current identity.

Acceptance:

- Her own profile shows "Edit profile" instead of Follow and Message, and the
  form is pre-filled with her current name, about text, avatar, and nostr
  address.
- Changing the name and about text and saving shows a success toast and updates
  the profile immediately.
- Uploading a new avatar updates the avatar shown, and changing the banner
  updates the banner at the top of her profile.

### US-079 — Read a person's notes

As bob, I want to browse alice's notes on her profile, so that I can catch up on
what she has posted.

Acceptance:

- Her profile lists her notes below her header, newest first, each showing her
  name, avatar, content, and a relative timestamp; replies to other people's
  notes are excluded.
- A note she has pinned appears above newer unpinned notes.
- Scrolling to the bottom loads older notes automatically; a profile with no
  notes shows a loading indicator that resolves to "No notes found for this
  profile."
- A note alice publishes from her own session appears at the top of bob's open
  view without a reload.

### US-080 — Preview a profile from anywhere

As alice, I want to click a name or avatar wherever it appears, so that I can
check who someone is without losing my place.

Acceptance:

- Clicking bob's avatar or mention in a member list or message opens a popover
  with his avatar, name, about text, status, and badges.
- The popover offers "View Full Profile", which navigates to his profile page.
- Closing the popover leaves alice where she was.

### US-081 — Inspect and share a profile

As alice, I want a profile's raw details and a shareable code, so that I can
verify an identity or pass it on.

Acceptance:

- "Profile Info" shows account creation date, a copyable nprofile link, the
  npub, and the raw profile event, with copy buttons that confirm.
- "Share" shows a scannable QR code and a copyable profile link.

### US-082 — Mute an account

As alice, I want a muted person's content hidden until I ask for it, so that
muting actually declutters my feeds.

Acceptance:

- Searching for bob in Muted Accounts under Settings › Content adds a removable
  badge with his name, and saving persists it across a reload.
- His notes then render as "You have muted this person." with a "Show anyway"
  link instead of their content, and revealing one leaves the others collapsed.
- Removing his badge and saving makes his notes display normally again.

## Settings & preferences

### US-084 — Block a relay you never want used

As bob, I want to block a relay, so that nothing I do reaches out to it.

Acceptance:

- Settings › Privacy shows how many relays are blocked, and opening that list
  from there offers a picker of the relays the client knows about.
- A relay added there appears in the blocked list and the count goes up.
- The picker stops offering a relay once it is blocked, while still offering the
  others.

### US-086 — Configure alerts

As alice, I want to choose what notifies me and how, so that alerts match how I
want to be interrupted.

Acceptance:

- Settings › Alerts opens with toggles reflecting the stored preferences; saving
  shows a confirmation toast and the values survive a reload.
- With every channel off, the alert-type section (activity, mentions, messages)
  appears disabled.
- Turning on push notifications triggers a browser permission request; if
  permission is refused, an error toast reports it and the push toggle settles
  off, leaving badge and sound settings untouched.
- "Discard Changes" reverts unsaved edits to the last saved values.

### US-087 — Configure content display

As alice, I want to control whether sensitive content and media are shown, so
that my feeds match my comfort level.

Acceptance:

- Turning off "Hide sensitive content" and saving persists across a reload.
- With "Show media" off, a message that is only an image url renders as a plain
  compact link instead of an inline image.
- With "Show media" off, a standalone external link renders as a plain compact
  link with no preview card or spinner.

### US-088 — Adjust send delay and media servers

As alice, I want to set how long sends are held and where uploads go, so that
the editor behaves the way I want.

Acceptance:

- Moving the send-delay slider updates the displayed seconds live, and the value
  persists after a reload.
- "Add Server" appends an editable media server entry, and removing one drops it
  from the list.
- Saving shows a success toast.

### US-089 — Configure privacy preferences

As alice, I want control over relay authentication and usage reporting, so that
I can manage the tradeoffs myself.

Acceptance:

- Turning on "Authenticate with unknown relays" and saving persists across a
  reload.
- Turning off "Report usage" and saving persists across a reload.
- "Discard Changes" reverts unsaved toggles.

### US-090 — Change the app's appearance

As alice, I want to set color scheme, visual theme, and font size, so that the
app looks and reads the way I want.

Acceptance:

- Selecting "Dark" applies the dark theme to the document immediately, and
  "System" follows the OS color-scheme preference.
- Choosing a different app theme applies it and persists after a reload.
- Dragging the font-size slider updates the displayed percentage and saves
  without a separate save button.

### US-091 — Set up how people zap you

As alice, I want a lightning address on my profile and sensible preset amounts,
so that zapping works without a connected wallet.

Acceptance:

- The wallet page shows "Not set" with no lightning address; entering one and
  saving updates the profile and the page, and clearing it returns to "Not set".
- "Add amount" appends an editable preset, and saving a zero or negative amount
  shows an error and does not save.
- The last remaining preset cannot be removed, and saved amounts persist across
  a reload.

## Admin, moderation & hosting

### US-092 — Edit a space's profile and featured content

As admin, I want to keep a space's public details and highlights current, so
that visitors see the right thing first.

Acceptance:

- "Edit this Space" updates name, description, and icon, shows a success
  message, and the About page reflects the change.
- Adding items in the Featured section renders them on the About page for every
  visitor.
- bob sees no edit or featured-content controls on the same space.

### US-093 — Create roles and assign them

As admin, I want custom roles I can hand out, so that members' responsibilities
are visible.

Acceptance:

- "Manage Roles" creates a role with a label, description, and color, which then
  appears in the roles list; editing its label updates the list.
- Adding members to a role, or checking it under a member's "Edit roles", shows
  the role's badge on that member's card in the directory; unchecking removes
  the badge.
- Searching the directory for the role's name filters to members holding it.
- Deleting a role warns that members keep their space membership, and confirming
  removes it from the list; bob sees no "Manage Roles" option.

### US-094 — Invite people to a space

As admin, I want a shareable invite and a direct-add path, so that I can grow
the space.

Acceptance:

- "Create Invite" shows a QR code and a copyable link, and copying puts it on
  the clipboard.
- Where the relay supports it, the invite dialog's member search adds someone
  straight into the member list.
- A room-scoped invite link carries both the space and that room's join code.

### US-095 — Remove, ban, and restore members

As admin, I want to take someone out of a space and reverse it later, so that I
can enforce membership.

Acceptance:

- Removing bob from his member card, after confirming, takes him out of the
  directory.
- Banning carol confirms with a success message and lists her under Banned
  Members instead of the active directory.
- Restoring her from that list returns her to the active member list.
- bob sees none of these controls on other members.

### US-096 — Moderate messages and posts

As a space, we want authors to remove their own content, everyone else to report
it, and admin to remove anything, so that moderation has a clear chain.

Acceptance:

- alice sees a delete option on her own article, message, or post; bob sees
  "Report Content" on hers instead, and reporting requires choosing a reason
  before it submits.
- admin sees a delete option on bob's message and on any member's article,
  thread post, or poll, even without being the author.
- Content admin deletes disappears for other viewers.

### US-097 — Work through the action-items queue

As admin, I want reports and join requests in one queue with a badge, so that I
don't have to go looking for them.

Acceptance:

- With nothing pending, the space menu shows no action-items badge; after bob
  reports a message or carol requests to join a closed room, admin sees a badge
  and an "Action Items (n)" count, which a non-admin never sees.
- The queue lists each report with its reported message and reporter, and each
  join request with the requester and target room.
- Accepting a join request adds that member to the room, and dismissing one
  clears it without granting membership.
- "Remove Content" on a report deletes the reported message and clears the item;
  dismissing clears the item and leaves the content alone.

### US-098 — Browse and create hosted spaces

As a space owner, I want to see the spaces I host and spin up new ones, so that
I can run a community without operating a relay.

Acceptance:

- With no hosted spaces, Settings › Hosting shows an empty state prompting
  creation; with some, each is listed with name, host, status badge, plan badge,
  and a Manage link.
- Creating a space with a name (which auto-fills the subdomain) on the free plan
  lands on the new space's admin page and adds it under "Your Spaces".
- Choosing a paid plan instead prompts for a payment method or an invoice
  immediately after creation.

### US-099 — Configure a hosted relay

As a space owner, I want to edit my relay's details and policies, so that it
behaves the way my community needs.

Acceptance:

- "Edit details" updates the relay's name and description on its detail card,
  and the activity feed lists the relay's creation event.
- Toggling "Public read" on persists across a reload.
- On the free plan, the Blossom and LiveKit toggles are disabled with a "Not
  available on your current plan" explanation.
- bob, a member but not the owner, visiting the same admin url sees a "Not a
  Coracle-hosted space" card linking to Settings › Hosting.

### US-100 — Change a hosted relay's plan

As a space owner, I want to move between plans, so that I can pay for what I
need.

Acceptance:

- Selecting a paid plan from "Change plan" and saving updates the relay's plan
  badge.
- Upgrading with no payment method configured opens payment setup or an open
  invoice right after saving.
- Downgrading to free turns the plan-gated Blossom and LiveKit toggles off
  automatically.

### US-101 — Point a custom domain at a hosted relay

As a space owner, I want members to connect through my own domain, so that the
space carries my branding.

Acceptance:

- Saving a domain under "Manage" shows it on the relay card with a "Pending"
  badge and the CNAME record to configure, whose copy button puts the target on
  the clipboard.
- "Verify DNS record" flips the badge to "Verified" once the backend reports it.
- The relay's displayed address then switches to the custom domain.

### US-102 — Pause a relay and settle the bill

As a tenant, I want to take a space offline temporarily and keep my account paid
up, so that hosting stays under my control.

Acceptance:

- "Deactivate" confirms with a warning about dropped connections and flips the
  status badge to inactive; "Reactivate" returns it to active.
- With an unpaid invoice, Settings › Hosting shows a banner whose "Pay now"
  opens a dialog with the amount and a Lightning QR code and bolt11 string;
  "Check payment" after the backend reports it paid shows a confirmed state and
  the banner disappears.
- Connecting a wallet through "Set up autopay" with an NWC url shows "Wallet
  connected" and marks Lightning as connected in the payment-methods list.
- Payment history lists past invoices with amount and billing period, most
  recent first.

## Notifications & navigation

### US-103 — See and clear unread indicators

As bob, I want unread activity marked where I'll see it, so that I know what to
check first.

Acceptance:

- After alice posts in a room bob hasn't opened, an unread dot appears on that
  room and on its space in his sidebar, and on the space's row in `/spaces`,
  without a reload.
- Opening the room clears its dot, and the dot stays cleared when he returns to
  the space list.

### US-104 — Mute a room or a whole space

As alice, I want to silence one noisy room or an entire space, so that I only
get pinged for what I care about.

Acceptance:

- Turning off Notifications in a room's detail panel shows a muted-bell icon on
  that room only, and new messages there produce no unread dot while a sibling
  room's still do.
- "Turn off notifications" in the space menu relabels itself to "Turn on
  notifications" and shows a muted-bell beside the space name, after which no
  room in it raises an unread dot.
- Turning either back on restores unread indicators for subsequent activity.

### US-120 — Read what a notification says

As alice, I want a notification to say what was written, so that I can tell
from it whether the message is worth opening.

Acceptance:

- With push notifications on and the tab in the background, a reply from bob in
  a room alice is in raises one naming her as mentioned.
- Its body is the words bob wrote rather than the quote his reply is prepended
  with, and a url in it is named by its host instead of spelled out.

### US-105 — Land on the home page

As a new user, I want the home page to route me somewhere useful, so that I'm
never staring at a blank screen.

Acceptance:

- On a build with a configured platform space, `/home` opens that space.
- With none configured, it shows the dashboard, whose empty inbox offers "Add a
  space" and "Start a conversation".
- Those options navigate to the spaces directory and the chat view respectively.

### US-116 — Read the home dashboard

As alice, I want the home page to tell me what happened while I was away, so
that I don't have to walk every space to find out.

Acceptance:

- The inbox lists each room and conversation with unread activity as a card,
  naming the room and space and showing the latest message, newest first. It
  holds messages only, and only while they are unread.
- Activity is a row of one card per space, counting what that space has waiting
  that isn't a message - threads, events, classifieds and the rest. A card
  disappears once its space is read.
- A conversation carries an unread dot, and "Mark all read" empties the inbox.
- Selecting a conversation opens it.
- Relay health checks are listed alongside the inbox, with the recommendation
  each one applies.
- Hosting is offered whether or not she hosts a space: a shortcut to the hosting
  panel when she has one, an invitation to start one when she doesn't.

### US-117 — See notes from the people I follow

As alice, I want the home page to show what the people I follow have posted, so
that home is worth opening when nothing is waiting for me.

Acceptance:

- The Network section lists notes from her follows, resolved through the relays
  those people publish to. A follow who is in none of her spaces reads the same
  way, replies included, since a note's replies are counted from the relay the
  note itself came from.
- It is a list of notes: a reply is counted on the note it answers rather than
  drawn underneath it, and never appears as an item of its own.
- Every note carries its reply count, including the ones with no replies.
- Scrolling to the end of the feed loads more rather than asking her to.

### US-106 — Share text into the app

As alice, I want to hand text to Flotilla and choose where it lands, so that I
can forward things from elsewhere.

Acceptance:

- Opening `/share` with text shows a Share dialog listing her rooms and
  conversations, searchable by name.
- Selecting a room and confirming navigates there with the shared text
  pre-loaded in the composer.
- The composer's content matches the text that was shared.

### US-107 — Open a nostr link

As alice, I want npub and nevent links to resolve to the right thing, so that
shared links just work.

Acceptance:

- Copying an event's link from its info panel and navigating to that url opens
  the matching message.
- Navigating to a profile's npub url opens that person's profile.
- An unresolvable nostr link redirects to the app's home rather than showing a
  broken page.

### US-110 — See another space's unread activity from a phone

As bob on a phone, I want the bottom bar's space-menu button to tell me another
space wants attention, so that I don't have to leave the room I'm reading to
find out.

Acceptance:

- While bob has a room open, a message in a space he isn't in raises an unread
  dot on the space-menu button, matching the dot that space's row carries in
  `/spaces`.
- A message in another room of the space he's already in does not; that space's
  own room list carries it.
- Reading the other space takes the dot down.

### US-112 — See which threads are unread

As bob, I want the Threads dot to lead me to the thread that raised it, so that
the indicator is something I can act on rather than dismiss.

Acceptance:

- A thread alice posted raises an unread dot on the Threads nav item; one bob
  posted himself does not.
- Opening the list keeps the dot on alice's row, so he can tell which thread is
  new, and bob's row still carries none.
- Leaving the list marks its threads read, and neither the row nor the nav item
  shows a dot afterwards.

### US-113 — See which threads are unread on a phone

As bob on a phone, I want the same dot on the thread that raised it, so that the
Threads indicator is as actionable on a phone as it is on a desktop.

Acceptance:

- The thread list in a board too narrow for the table is a list of links rather
  than a table, and alice's thread carries a dot there; bob's own does not.

### US-114 — See which listings are unread

As bob, I want the same dot on a board whose items are cards rather than rows,
so that every content section answers "which one is new" the same way.

Acceptance:

- A listing alice posted raises an unread dot on the Classifieds nav item; one
  bob posted himself does not.
- Opening the list keeps the dot on the corner of alice's card, and bob's own
  card carries none.

## Out of scope

Features the e2e suite cannot exercise, and what stops it.

**Lightning payments and wallets.** Sending a zap on a message, article, thread
post, comment, or note; contributing to a funding goal; connecting a wallet over
Nostr Wallet Connect; the wallet page's connection status and balance;
disconnecting a wallet; paying and receiving invoices. The harness mocks zapper
_discovery_ (Dufflepud's `/zapper/info`) and stands up a WebLN provider that
answers the connection handshake, but not the LNURL invoice callback, the
payment leg, or an NWC responder on a relay of its own. Existing zap receipts
can be seeded, so a zap total rendered on a message is testable; the
send-and-settle flow is not.

**Voice and video rooms.** Creating or joining a Voice room, the mic-preview and
device-picker dialog, mute/camera/screen-share controls, speaking indicators,
the video tile layout, the persistent call banner, and reconnect handling. The
LiveKit token endpoint is mockable, but the media itself is WebRTC negotiation
that the harness cannot intercept.

**Native push and badges.** OS push delivery over the web Notification API, FCM,
or APNs; tapping a push to jump to content; the first-chat push permission
prompt; the app-icon badge count and its settings toggle; the new-activity
chime. These need a real push subscription and service worker, or a Capacitor
plugin with no browser equivalent.

**Other native Capacitor surfaces.** Logging in with an Android NIP-55 signer
app; receiving an Android share intent; custom-scheme and universal deep links
dispatched by the OS; the native share sheet on a profile QR code; native
clipboard image paste; the Android video thumbnail poster; the iOS hosting
restriction. All are gated on a native platform the browser run never reports.

**Camera and QR scanning.** Scanning a bunker link or an NWC connection secret
with the device camera. Requires real `getUserMedia` hardware with no mock seam.

**Custodial (Pomade) accounts.** Email and password signup with its emailed
confirmation code, email login, one-time-code login, password reset, choosing
among accounts sharing an email, managing other sessions, and migrating from
custody to self-custody. All of it talks to the external Pomade signer network,
which has no mock seam; the harness only injects local-key sessions, and the
email option is hidden when `POMADE_SIGNERS` is unset.

**Card payments.** Paying a hosting invoice by card navigates to Stripe's
hosted checkout and is confirmed by a backend webhook. The Lightning path for
the same invoice is covered by US-102.

**External link-outs.** Self-hosted and third-party options on the
space-creation page, the About page's source, blog, podcast and support links,
and a note's timestamp permalink to another nostr client. The harness blocks
navigation off the app's origin, so nothing about the destination is observable.

**Diagnostic log sending.** The privacy page's button that bundles client-side
logs into a DM to the platform's support contact. It targets a hardcoded pubkey
whose relays are not part of the sealed test network.

**A network read that fails.** Every relay a scenario declares answers, and a url the container
does not serve is answered by an empty relay rather than refused, so no spec can express a read
that fails. That leaves one invariant untested: a send whose reads fail before the message exists
must keep the text in the composer and say so, rather than clearing as though it went. It is the
shape of the bug that motivated US-108 — `@welshman/store`'s `load` rejects rather than resolving
empty, so a failure there aborts a publish before its thunk is made and nothing reaches the
timeline to carry a status. Testing it needs a seam for making a relay unusable.

**Internals with no user-visible surface.** The legacy session-storage format
migration, which has no observable difference and no supported way to seed the
old shape. `ProfileFeed` and `ProfileLatest` components that no route reaches.
