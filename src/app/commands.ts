import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {
  Address,
  COMMAND,
  bindCommandArgs,
  getActiveCommandArgIndex,
  parseCommandInvocation,
} from "@welshman/util"
import type {
  CommandArg,
  CommandArgBinding,
  CommandInvocation,
  CommandScopeTarget,
} from "@welshman/util"
import {Command} from "@welshman/domain"
import type {CommandReader} from "@welshman/domain"
import {Domain, Network, RelayScopedDerivedPlugin, createSearch, projectFrom} from "@welshman/app"
import type {IApp, Projection} from "@welshman/app"
import {fromApp, usePlugin} from "@app/core"

// NIP-CD definitions count where they're published, since a space curates its own command
// namespace by controlling who may write to it. `|` never appears in a url, and keeps these
// distinct from the `'`-separated room keys.
const makeCommandKey = (url: string, address: string) => `${url}|${address}`

const splitCommandKey = (key: string): [string, string] => {
  const i = key.indexOf("|")

  return [key.slice(0, i), key.slice(i + 1)]
}

export class Commands extends RelayScopedDerivedPlugin<CommandReader> {
  // Definitions are replaceable, so one pull per space keeps the repository current. The set
  // lives on the plugin rather than the module so logging in, which swaps the app and its
  // repository, starts over.
  private pulled = new Set<string>()

  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [COMMAND]}],
      eventToItem: app.use(Domain).reader(Command),
      getKey: (command, url) => makeCommandKey(url, command.address()),
    })
  }

  fetch(key: string) {
    const [url, address] = splitCommandKey(key)
    const {pubkey, identifier} = Address.from(address)

    return this.app
      .use(Network)
      .load({relays: [url], filters: [{kinds: [COMMAND], authors: [pubkey], "#d": [identifier]}]})
  }

  ensureLoaded = (url: string) => {
    if (!this.pulled.has(url)) {
      this.pulled.add(url)
      this.app.use(Network).load({relays: [url], filters: [{kinds: [COMMAND]}]})
    }
  }

  forUrl = (url: string): Projection<CommandReader[]> =>
    projectFrom(this.index, byKey =>
      Array.from(byKey.entries())
        .filter(([key]) => key.startsWith(`${url}|`))
        .map(([, command]) => command),
    )
}

export const commands = usePlugin(Commands)

// The definitions an executor is listening for, given the event that would be written.
export const getCommandsForTarget = (target: CommandScopeTarget) =>
  commands
    .get()
    .forUrl(target.url ?? "")
    .get()
    .filter(command => command.matches(target))

export const deriveCommandsForTarget = (target: CommandScopeTarget): Readable<CommandReader[]> =>
  derived(
    fromApp($app => $app.use(Commands).forUrl(target.url ?? "").$),
    $commands => $commands.filter(command => command.matches(target)),
  )

// Without a qualifier an invocation targets every definition whose trigger matches, so more
// than one here is what tells a composer to disambiguate.
export const getCommandsForInvocation = (
  available: CommandReader[],
  invocation: CommandInvocation,
) =>
  available.filter(
    command =>
      command.command() === invocation.command &&
      (!invocation.pubkey || command.author() === invocation.pubkey),
  )

export const createCommandSearch = (target: CommandScopeTarget) =>
  createSearch(
    getCommandsForTarget(target).map(command => ({
      address: command.address(),
      command: command.command() ?? "",
      title: command.title() ?? "",
      description: command.description() ?? "",
    })),
    {
      getValue: option => option.address,
      fuseOptions: {keys: ["command", "title"], threshold: 0.3},
    },
  )

export const getCommandByAddress = (url: string, address: string) =>
  commands.get().get(makeCommandKey(url, address))

// An invocation in progress, as the composer understands it. `matches` holds every definition
// the text currently targets, so an ambiguous trigger is visible rather than guessed at, and
// `command` is the one whose arguments shape the input.
export type CommandDraft = {
  invocation: CommandInvocation
  command: CommandReader
  matches: CommandReader[]
  args: CommandArg[]
  // One entry per argument the text supplies, in order, so an argument already typed can be
  // shown as bound or as wrong while the rest are still being entered
  bindings: CommandArgBinding[]
  activeIndex: number
}

export const describeCommandDraft = (
  available: CommandReader[],
  content: string,
): CommandDraft | undefined => {
  const invocation = parseCommandInvocation(content)
  const matches = invocation ? getCommandsForInvocation(available, invocation) : []
  const command = matches[0]

  if (invocation && command) {
    const args = command.args()

    return {
      invocation,
      command,
      matches,
      args,
      bindings: bindCommandArgs(args, invocation.rest),
      activeIndex: getActiveCommandArgIndex(args, invocation.rest),
    }
  }
}
