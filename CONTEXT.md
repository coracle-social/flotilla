# Flotilla - AI Assistant Context

## Project Overview

Flotilla is a Discord-like Nostr client based on the concept of "relays as groups". It's built with SvelteKit, TypeScript, and Capacitor for cross-platform support (web, Android, iOS).

On boot, please run `tree -I assets src` to get an idea of the project structure.

## Key Dependencies

`@welshman/*` libraries contain the majority of nostr-related functionality.
`@app/core/*` contains additional app-specific data stores and commands.

When creating an import statement, first identify what functionality you need. Search the codebase for components with similar functionality, and imitate their imports.

## Dependency Graph (Acyclic)

The project follows a strict dependency hierarchy:
1. **External libraries** (bottom layer)
2. **`lib/`** - Only depends on external libraries
3. **`app/core/`** and **`app/util/`** - Can depend on `lib` only
4. **`app/components/`** - Can depend on anything in `app` or `lib`
5. **`routes/`** - Can depend on anything (top layer)

**Import Ordering Convention:** Always sort imports by dependency level:
1. Third-party libraries first
2. Then `lib` imports
3. Then `app` imports

## Development Conventions

When creating components related to a given space or room, parameterize them only with the entity's identifier (i.e., `url` and `h`). Only pass additional props if they can't be derived from the identifiers. For example, a room's `members` should be derived inside the child component, not passed in by the parent.

Do not use null, only undefined.
