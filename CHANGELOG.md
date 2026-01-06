# Changelog

# Current

* Fix skinny profile images
* Custom handler for relay urls
* Hide tooltips on mobile
* Sort comments ascending
* Make video embeds rounded
* Fix ProfileMultiSelect styling
* Accept hex pubkeys/npubs/nprofiles in ProfileMultiSelect
* Tweak room edit form design
* Report pending signer to user
* Update default relays
* Fix chat list responsiveness

# 1.6.0

* Switch back to indexeddb to fix memory and performance
* Add pay invoice functionality
* Add space membership management and bans
* Add event info to profile dialog
* Add better room membership management
* Refactor stores for performance
* Hide nav when keyboard is open
* Handle flotilla links in-app
* Fix new messages indicator z-index
* Fix some display bugs
* Add date to chat items
* Refine data synchronization
* Hide nav when keyboard is open on mobile

# 1.5.3

* Add space edit form
* Improve room syncing
* Return better blossom errors
* Fix access restricted bugs
* Add room detail dialog
* Fix broken link to self hosting
* Tweak shadows
* Always join spaces when visiting them

# 1.5.2

* Fix negentropy room syncing

# 1.5.1

* Fix chat path link

# 1.5.0

* Restyle mobile dialogs
* Add room membership lists
* Add space membership lists
* Add edit room form
* Support closed/private/restricted/hidden rooms
* Add hosting services page
* Improve performance and UI
* Fix push notifications
* Improve error detection and handling
* Support invite links on discover page
* Add link to landlubber if user is admin
* Clear reply/share/edit on escape

# 1.4.1

* Improve data synchronization
* Fix app url on capacitor deployments

# 1.4.0

* Allow "editing" chat messages
* Check for room create permission
* Re-work space navigation
* Show all messages in non-nip29 chat
* Improve synchronization logic
* Add connection status to space menu
* Add icon picker to room create component
* Improve mention suggestions
* Improve storage adapter and relay list performance
* Fix modals
* Add room deletion
* Fix zapper loading
* Add support for relay/group member lists and join/leave events

# 1.3.1

* Fix memory leak in storage adapter
* Show fewer annoying toast messages

# 1.3.0

* Add optional badge and sound for notifications
* Improve link rendering
* Remove imgproxy
* Bring back blossom feature detection for spaces
* Improve light theme
* Add more info to signer status
* Simplify navigation for adding a space
* Add ability to scan QR code for invite links
* Streamline wallet setup and move receive address setting
* Remove indexeddb on mobile, use capacitor file storage API
* Fix duplicate DMs showing up

# 1.2.5

* Fix icons in build

# 1.2.4

* Add direct message alerts
* Add alert settings page
* Add instructions to key download
* Add option that allows relays to strip signatures
* Detect relays that mostly refuse to serve requests
* Compress and upload profile images
* Use system theme by default
* Switch icon set, refactor how they're included
* Use capacitor's preferences for storage instead of localStorage

# 1.2.3

* Add `created_at` to event info dialog
* Add signer status to profile page
* Re-work bunker login flow
* Add in-app onboarding flow
* Only protect events if relay authenticates
* Filter out non-global chats from global chat
* Improve publish status indicator
* Fix encrypted upload content type
* Add relays to event details dialog
* Add universal link handler for apps

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
