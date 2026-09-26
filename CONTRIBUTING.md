## Project Overview

Flotilla is a Nostr "relays as groups" community chat client. It implements NIP-29 (relay-based groups) to create Discord-like spaces (servers) and rooms (channels).

Please visit our [issue tracker](https://gitea.coracle.social/coracle/flotilla/issues) to contribute. Any new issues should be opened without a milestone, label, or project and the project owners will triage them.

### Milestones

Milestones indicate how soon a given task should be tackled.

- [Current](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&milestone=1) issues are immediately actionable.
- [Next](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&milestone=2) means an issue is blocked.
- [Future](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&milestone=3) means we're deferring work until a later date.

### Labels

- [Design](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&labels=15) issues need design work before being implemented. This might take the form of a high-quality mockup, wireframes, user flows, or just a couple notes about where things go, depending on the nature of the task.
- [Dev](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&labels=16) issues are ready to be implemented. Most of the work will be related to architecting and writing code.
- [Easy](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&labels=14) issues have no dependencies, and are scoped quite narrowly.
- [Priority](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&labels=6) issues include bugs and urgent feature requests. These should get attention first if possible, although sometimes long-standing performance issues or subtle bugs might end up here for a while.
- [Ideas](https://gitea.coracle.social/coracle/flotilla/issues?type=all&state=open&labels=13) are for things that aren't scoped out yet, or which need protocol work before getting designed or implemented.

### Projects

Issues may or may not have a project. Projects are used to group issues thematically just for organization.

## Coding conventions

There are a few conventions that are helpful to know right out of the gate.

- Most nostr protocol functionality is implemented via the [welshman library](https://welshman.coracle.social/)
- Use Svelte 4 **stores** rather than runes for all state outside UI components
- Most global state flows through Welshman's `repository` (unidirectional)
- Query state using `deriveEventsMapped` or `deriveProfile` etc
- Events are published via `publishThunk`, which allows for optimistic UI updates during signing/pow generation.
- Components should have minimal props - e.g. instead of passing a whole `relay` through, pass its `url`.
- Use `AbortController` when possible instead of request ids
- Use `undefined` or optional properties instead of `null`
- Do not use `any`. If there are type errors related to `unknown`, they are likely because the upstream definition of the data is incorrect.
- Avoid using `as`, except where necessary. Instead, annotate function parameters, and ensure upstream values are typed correctly.
- When dynamically building classes, use `cx` from `classnames`.
- Do not define svelte event handlers inline, instead name them and put them in the script section of templates.

## Contributing Workflow

To contribute, do the following:

- Find or create an issue and assign yourself (comment instead if you're not able to self-assign)
- If the issue is a design task, attach or link out to any mockups/wireframes/flowcharts
- Once a design task is completed, a maintainer will remove the `design` label and add the `dev` label
- If the issue is a development task, fork the repository and create a branch prefixed by the issue number, e.g. `105-deep-links`
- Line endings are pinned to LF by `.gitattributes`. A Windows clone made before that was added keeps CRLF and fails `pnpm run lint`. Commit or stash your work first, then run `git rm --cached -r . && git reset --hard` once to re-checkout every file.
- Before requesting a review, be sure to review any agent-generated code, run the pre-commit hooks, and test the changes.
- Open a PR and request a review. A maintainer will get back to you with requested changes, or will merge the PR.
- Keep your PR up-to-date by rebasing frequently on `dev`. Avoid force-pushing to `dev`.
- PRs are rebased, squashed, and merged to keep commit history simple.
- An issue may have multiple PRs. Once complete, it can be closed.
