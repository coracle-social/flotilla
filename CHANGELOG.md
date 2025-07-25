# Changelog

# 1.2.2

* Fix phantom chat notifications
* Fix zaps on mobile

# 1.2.1

* Add zaps to chat, threads, and events
* Add funding goals
* Add NWC support
* Add wallet settings page
* Handle invalid bunker url
* Fix sidebar overflow
* Fix profile npub display

# 1.2.0

* Fix sort order of thread comments
* Fix link display when no title is available
* Fix making profiles non-protected
* Replace bunker url with relay claims for notifier auth
* Add push notifications on all platforms
* Add "mark all as read" on desktop
* Re-design space dashboard

# 1.1.1

* Add chat quick link

# 1.1.0

* Add better theming support
* Improve forms for entering invite codes
* Rely more heavily on NIP 29 for rooms
* Support multiple platform relays
* Remove default general room
* Remove room tag from threads/calendars
* Show pubkey on profile detail
* Support pasting pubkey into chat start dialog
* Add minimal style for quoted messages

# 1.0.4

* Fix thunk status click handler
* Remove duplicate dependencies
* Improve navigation on white-labeled instances
* Add setting for font size

# 1.0.3

* Add light theme
* Use correct alerts server
* Ignore relay errors for claims
* Fix inline code blocks
* Add custom emoji parsing and display

# 1.0.2

* Fix add relay button
* Fix safe inset areas
* Better rendering for errors from relays
* Improve remote signer login

# 1.0.1

* Fix relay images in nav
* Fix relay nav overflow

# 1.0.0

* Add alerts via Anchor
* Fix nip46 signer connect
* Allow use of cleartext relays on native builds
* Fix some modal state bugs caused by svelte 5
* Detect blossom support on community relays
* Use user blossom server list in settings
* Fix some feed bugs
* Improve thunk indicator
* Update storage adapters
* Fix modal flash
* Switch to pnpm
* Improve calendar windowing

# 0.2.14

* Add calendar event editing

# 0.2.13

* Fix android keyboard issue

# 0.2.12

* Fix keyboard covering chat input
* Fix thread replies
* Make error reporting and analytics optional
* Replace long press with tap target
* Fix time input
* Fix nevent hints for url-specific stuff
* Fix confirm and reactions on mobile
* Add reply to chat on mobile
* Fix profile suggestions

# 0.2.11

* Add in-app signup flow on ios
* Add profile deletion

# 0.2.10

* Improve space discovery

# 0.2.9

* Add NIP 01 signup flow on mobile

# 0.2.8

* Show spinner when joining a room
* Reduce self-rate limiting of REQs
* Fix disabled signers link
* Prepare for iOS release
* Improve threads and calendar pages
* Improve quote rendering and new messages button

# 0.2.7

* Add calendar events
* Migrate to svelte 5 (fixes some bugs, probably introduces others)
* Migrate to new welshman editor
* Make reply indicator nicer
* Make share indicator nicer
* Improve feed loading
* Show marker for last activity in chat

# 0.2.6

* Add reply to long-press menu
* Fix @-mentions
* Replace nsec.app signup with njump.me
* Add new messages button in rooms
* Add media server settings
* Add build hash to about page

# 0.2.5

* Improve room and data loading
* Use @welshman/editor
* Drop support for legacy event kinds
* Add support for back button navigation on android
* Remove note to self page (still available via chat)
* Improve chat conversation search
* Change how reply UI works

# 0.2.4

* Update icons

# 0.2.3

* Add NIP 56 reports for messages and threads
* Add ToS and privacy policy
* Add avatar fallback icons
* Add mark as read to chats
* Add send button to chat compose
* Accommodate onion URLs
* Improve loading and notifications

# 0.2.2

* Fix bug with sending messages

# 0.2.1

* Improve performance, as well as scrolling and loading
* Integrate @welshman/editor
* Improve NIP 29 compatibility
* Fix incorrect connection errors
* Refine notifications
* Add room menu to space homepage
* Fix storage bugs
* Add join space CTA
