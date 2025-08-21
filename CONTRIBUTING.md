# Contributing guidelines

## Project Overview

Flotilla is a svelte/typescript/capacitor project. It's intended to be an alternative to Discord for Nostr users. A high-quality UX is a priority, with an emphasis on well-tested, intuitive designs, and robust implementations.

## Getting Started

Run `pnpm run dev` to get a dev server, and `pnpm run check:watch` to watch for typescript errors. When you're ready to commit, a pre-commit hook will run to lint and typecheck your work. To run the project on Android or iOS, use Android Studio or Xcode.

The `master` branch is automatically deployed to production, so always work on feature branches based on the `dev` branch. This project frequently uses unreleased versions of [welshman](https://welshman.coracle.social), using `pnpm` link to hotlink a local copy of the code. To set that up, clone welshman to the parent directory of your `coracle` client, then add `link:../welshman/packages/packagename` to the `pnpm.overrides` section of your `package.json`. Below is a nodejs script that will do that automatically for you:

```javascript
#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))

packageJson.pnpm.overrides = Object.keys(packageJson.dependencies)
  .filter(pkg => pkg.startsWith('@welshman/'))
  .reduce((acc, pkg) => {
    const packageName = pkg.split('/')[1]
    acc[pkg] = `link:../welshman/packages/${packageName}`
    return acc
  }, {})

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n')

console.log('Added welshman package overrides.')
```

Be sure to avoid committing overrides to either `package.json` or `pnpm-lock.yaml`. These overrides can generally be added, installed, and removed, and will persist until another `pnpm install` command gets run.

## File Structure

The main parts of the application are as follows:

- `static` - static assets like fonts, images, etc.
- `src/assets` - svgs for use as icons.
- `src/lib` - general purpose components and utilities.
- `src/app/core/state` - environment variables, constants, custom stores, and some utilities derived from them.
- `src/app/core/requests` - utilities related to loading data from the nostr network.
- `src/app/core/commands` - utilities related to publishing nostr events and uploading media to blossom servers.
- `src/app/utils` - other application logic, including stuff related to modals, routing, etc.
- `src/app/editor` - configuration for `@welshman/editor` for use in various app views.
- `src/app/components` - reusable components that depend on other `app` stuff.
- `src/routes` - file-based routing interpreted by sveltekit.

Application organization is based on an acyclic dependency graph:

- `routes` can depend on anything
- `app/components` can depend on anything in `app` or `lib`
- `app/utils` and `app/core` can only depend on `lib`
- `lib` (and everything else) can depend only on external libraries

The main stylistic/organizational rule when working in this project is that imports should be sorted based on the dependency graph. Third-party libraries should come first, then `lib`, then `app`.

## System Architecture

Flotilla's architecture generally mirrors the file structure. State is stored using Svelte `store`s provided either by `@welshman/app` or by `app/core/state`, allowing for idiomatic svelte 4 usage (svelte 5 runes are [ghey](https://habla.news/u/hodlbod@coracle.social/1739830562159) and not allowed outside of UI components).

State is then synchronized to local storage or indexeddb using storage helpers provided by welshman in `routes/+layout.svelte`. Other top level synchronization logic generally belongs there.

`app/core/state` contains all environment variables, constants, custom stores, and utilities derived from them. Most stores are `derived` from our event `repository` using `deriveEventsMapped`, which efficiently queries the repository and maps events to custom data structures. Some of these data structures are provided by `welshman`, and some are defined in `app/core/state`. In either case, they can always be mapped back to an event, which is important for updating replaceables without dropping unknown data.

Here are a few important domain objects:

- Spaces are relays used as community groups. Their `url`s are core to a lot of data and components, and are frequently passed around from place to place.
- Chats are direct message conversations. There is currently some ambiguity in routing, since relays that don't support NIP 29 also have a "chat" tab, which uses vanilla NIP-C7.
- NIP 29 groups are variously called "rooms" and "channels". Conventionally, a "room" is a group id, while a "channel" as an object representing the group's metadata.
- "Alerts" are records of requests the user has made to be notified, following [this NIP](https://github.com/nostr-protocol/nips/pull/1796)

`app/core/requests` contains utilities related to loading data from the nostr network. This might include feed manager utilities, loaders, or listeners.

`app/core/commands` contains utilities related to publishing nostr events and uploading media to blossom servers. This also includes utilities related to sending lighting payments, authenticating with relays, or probing relay policy. Event creation should generally be split into `make` functions which build the event, and `publish` functions which publish the event using `publishThunk`.

Any of these utilities can be included either in `app/components` or `routes`. Crucial to keep in mind is that nearly all global state runs through welshman's `repository` in a unidirectional way. To update state, run `publishThunk`, which immediately publishes the event to the local repository. State can be read from the repository using `deriveEventsMapped` or other utilities provided by welshman like `deriveProfile`.

Thunks are designed to reduce UI latency, handling signatures and delayed sending the background. In most cases, thunk status should be displayed to the user so that they can cancel sending or address errors.

Toast, modals, and sidebar dialogs are controlled in `app/util/modal` and `app/util/toast`. In both cases, component objects can be passed along with parameters, but care has to be taken that the calling component either doesn't unmount before the modal (as when one modal replaces another), or that `$state.snapshot` is appropriately called on any state runes. These components frequently run into weird svelte compiler bugs too, in which case you may have to do some silly things to cope.

## Issues and Pull Requests

All work by contributors should be done against an issue. If there is no issue for the work you're doing, please open one or ask the project owner to open one. All PRs should be opened against the `dev` branch (unless for hotfixes).

## Communication

Discussion about development is done [on Flotilla](https://app.flotilla.social/spaces/internal.coracle.social). The group is currently closed, so please let me know if you'd like access.

## Project License

This project is licensed under the MIT license. By contributing, you agree to waive all intellectual property rights to your contributions to this project.

