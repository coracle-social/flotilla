## Project Overview

Flotilla is a Nostr "relays as groups" community chat client. It implements NIP-29 (relay-based groups) to create Discord-like spaces (servers) and rooms (channels).

**Tech Stack:**

- SvelteKit 5.48+ with TypeScript 5.9+
- Capacitor for cross-platform (Web/PWA, Android, iOS)
- TailwindCSS + DaisyUI for styling
- Welshman library suite for Nostr protocol
- IndexedDB for local storage
- Vite for building

**Key Concepts:**

- **Spaces** - Relays used as community groups (like Discord servers)
- **Rooms** - NIP-29 groups within spaces (like Discord channels), identified by `h`
- **Chats** - Direct message conversations (NIP-04/NIP-44 encrypted)

## Architecture & Dependency Graph

The project follows a **strict acyclic dependency hierarchy**:

```
routes/                    (top layer - can depend on anything)
  ↓
app/components/            (can depend on app/* and lib/*)
  ↓
app/core/ & app/util/      (can only depend on lib/*)
  ↓
lib/                       (can only depend on external libraries)
  ↓
external libraries         (bottom layer)
```

**Import Ordering Convention (CRITICAL):**
Always sort imports by dependency level:

1. Third-party libraries first
2. Then `lib/` imports
3. Then `app/` imports

Example:

```typescript
import {derived} from "svelte/store"
import {throttle} from "throttle-debounce"
import {Dialog} from "$lib/components"
import {repository} from "$app/core/state"
```

## File Structure

```
src/
├── lib/                          # Generic reusable code
│   ├── components/               # 38 UI components (Button, Dialog, etc.)
│   ├── html.ts                   # DOM utilities
│   ├── indexeddb.ts              # IndexedDB helpers
│   └── util.ts                   # Generic utilities
│
├── app/
│   ├── core/
│   │   ├── state.ts              # State management, stores, constants (687 lines)
│   │   ├── commands.ts           # Publishing events and other write operations (440+ lines)
│   │   ├── requests.ts           # Loading data from network (191 lines)
│   │   ├── sync.ts               # Data synchronization (296 lines)
│   │   └── storage.ts            # IndexedDB setup
│   │
│   ├── util/
│   │   ├── notifications.ts      # Push notifications (731 lines)
│   │   ├── policies.ts           # Relay policies
│   │   ├── routes.ts             # Routing helpers
│   │   ├── modal.ts              # Modal management
│   │   ├── toast.ts              # Toast notifications
│   │   ├── theme.ts              # Theme switching
│   │   └── keyboard.ts           # Keyboard handling
│   │
│   ├── editor/                   # Rich text editor config
│   │   ├── index.ts              # TipTap setup with Nostr integration
│   │   ├── EditorContent.svelte
│   │   └── MentionNodeView.ts
│   │
│   └── components/               # 188 app-specific components
│       ├── Space*.svelte         # Space/relay management
│       ├── Room*.svelte          # Room/channel management
│       ├── Chat*.svelte          # Direct messaging
│       ├── Profile*.svelte       # User profiles
│       ├── Thread*.svelte        # Threaded posts
│       └── ...
│
├── routes/                       # SvelteKit file-based routing
│   ├── +layout.svelte            # Root layout (sync logic here)
│   ├── spaces/                   # Space management
│   │   └── [relay]/              # Specific space
│   │       ├── chat/             # Space chat
│   │       ├── threads/          # Thread posts
│   │       ├── calendar/         # Events
│   │       └── [h]/              # Specific room (h = room id)
│   ├── chat/                     # Direct messages
│   ├── settings/                 # User settings
│   └── [bech32]/                 # Bech32 entity viewer
│
├── assets/icons/                 # ~1,277 SVG icons
├── app.html                      # HTML template
├── app.css                       # Global styles
└── types.d.ts                    # Type definitions
```

## State Management

**Core Principles:**

- Use Svelte 4 **stores** for all state (NOT runes outside UI components)
- Most global state flows through Welshman's `repository` (unidirectional)
- Query state using `deriveEventsMapped` or `deriveProfile` etc
- Update state by publishing events via `publishThunk`

**Thunks:**

- Reduce UI latency by handling signatures and sending in background
- Return status that should be displayed to user
- Allow cancellation and error handling
- Immediately publish to local repository for optimistic updates

## Nostr Integration

**Welshman Library Suite:**

- `@welshman/app` - High-level state (pubkey, signer, repository, tracker)
- `@welshman/net` - Network layer (Pool, Socket, load, pull, request)
- `@welshman/store` - Svelte integration (deriveEventsMapped, etc.)
- `@welshman/util` - Event utilities (kinds, tags, validation)
- `@welshman/signer` - Signing abstraction (NIP-01, NIP-07, NIP-46)
- `@welshman/router` - Relay routing (inbox/outbox model)
- `@welshman/editor` - Rich text editor with Nostr
- `@welshman/content` - Content parsing
- `@welshman/feeds` - Feed management

**Key NIPs Implemented:**

- NIP-01: Basic protocol
- NIP-44/59/17: Encrypted DMs
- NIP-07: Browser extension signing
- NIP-19: Bech32 encoding
- NIP-29: Relay-based Groups
- NIP-42: Relay authentication
- NIP-43: Relay membership
- NIP-46: Nostr Connect (remote signing)
- NIP-57: Lightning Zaps

## Development Conventions

**Component Parameterization:**

- Only pass entity identifiers (`url` for spaces, `h` for rooms)
- Derive all other data inside the component from identifiers
- Example: Don't pass `members` prop, derive it from `h` inside component

**CRITICAL Code Style Guidelines:**

- **No `null`** - only use `undefined`
- Svelte 5 runes (`$state`, `$derived`, `$effect`) only in UI components
- TailwindCSS and DaisyUI styling
- Only add comments for really weird stuff
- Do not call functions in components unless a parameter is reactive. Instead, use a svelte store or rune to make it reactive.
- Do not use `any`. If there are type errors related to `unknown`, they are likely because the upstream definition of the data is incorrect.
- When dynamically building classes, use `cx` from `classnames` rather than embedded ternaries or svelte 4's old `class:` syntax.
- When creating forms, use `FieldInline` or `Field` instead of custom elements/tailwindcss
- Do not define svelte event handlers inline, instead name them and put them in the script section of templates
- Avoid using `as`, except where necessary. Instead, annotate function parameters, and ensure upstream values are typed correctly.

**Human-First Simplicity (Jon Staab Style):**

- Prefer direct, readable code over layered abstractions.
- Do not add indirection (extra helpers, wrappers, stores, or derived state) unless it removes real repeated complexity.
- Reuse existing Welshman and Flotilla primitives before introducing new utilities or dependencies.
- Favor linear control flow and explicit naming over clever patterns.
- Remove defensive checks that do not apply in this runtime model.
- When two approaches work, pick the one that feels more human and easier to maintain.

## Common Tasks

### Adding a New Component

1. Determine if it's generic (`lib/components/`) or app-specific (`app/components/`)
2. Follow naming convention: `PascalCase.svelte`
3. Import in dependency order (3rd party → lib → app)
4. Use stores for state, runes only for UI reactivity

### Creating a New Route

1. Add to `src/routes/` following SvelteKit conventions
2. Use `+page.svelte` for page component
3. Use `+layout.svelte` for shared layouts
4. Top-level sync logic goes in root `+layout.svelte`

### Loading Data from Network

1. Use utilities from `app/core/requests.ts`
2. Or create derived stores in `app/core/state.ts`
3. Use `load`, `pull`, or `request` from `@welshman/net`

### Publishing Events

1. Create `make*` function to build event template
2. Create `publish*` function using `publishThunk`
3. Display thunk status to user (for cancel/error handling)
4. These go in in `app/core/commands.ts`

### Managing Modals/Toasts

- Import from `app/util/modal.ts` or `app/util/toast.ts`
- Pass component objects with parameters
- Use `$state.snapshot` if calling component might unmount

## Development Workflow

Agents should not run the dev server or build the app. Instead, use the following commands:

```bash
pnpm run format           # Format changed files
pnpm run lint             # Check formatting and linting
pnpm run check            # Type check
```

**Welshman Development:**

- Clone welshman to parent directory
- Use `./link_deps` script to link local welshman packages
- Avoid committing `pnpm.overrides` changes

**Git Workflow:**

- `master` branch auto-deploys to production
- Work on feature branches based on `dev` branch
- Pre-commit hooks run lint/typecheck automatically

## Environment Variables

See `.env.template` for all options.

## Important Files to Reference

- **src/app/core/state.ts** - All stores and constants
- **src/app/core/sync.ts** - Data synchronization
- **src/app/core/requests.ts** - Utilities for requesting data
- **src/app/core/commands.ts** - Publishing patterns
- **src/app/util/notifications.ts** - Notification badges and push notifications
- **src/routes/+layout.svelte** - Top-level sync logic

## Mobile Development

**Capacitor Integration:**

- Android: Full support, APK builds via `pnpm run release:android`
- iOS: Full support (zaps disabled due to App Store policy)
- PWA: Progressive Web App with service worker

**Native Features:**

- Push notifications (FCM/APNs)
- Deep linking (nostr: and https: URLs)
- Native signing plugin
- Keyboard management
- Safe area handling
- Badge management
