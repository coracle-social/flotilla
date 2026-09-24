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

// `|` never appears in a url, and keeps these distinct from the `'`-separated room keys.
const makeCommandKey = (url: string, address: string) => `${url}|${address}`

const splitCommandKey = (key: string): [string, string] => {
  const i = key.indexOf("|")

  return [key.slice(0, i), key.slice(i + 1)]
}

export class Commands extends RelayScopedDerivedPlugin<CommandReader> {
  // The set lives on the plugin, so logging in and swapping the repository starts over.
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

    return this.app.use(Network).loadComplete({
      relays: [url],
      filters: [{kinds: [COMMAND], authors: [pubkey], "#d": [identifier]}],
    })
  }

  ensureLoaded = (url: string) => {
    if (!this.pulled.has(url)) {
      this.pulled.add(url)
      this.app.use(Network).loadLenient({relays: [url], filters: [{kinds: [COMMAND]}]})
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

// One store per url, and subscribing to it is what pulls the definitions.
const commandsByUrl = new Map<string, Readable<CommandReader[]>>()

const deriveCommandsForUrl = (url: string): Readable<CommandReader[]> => {
  const cached = commandsByUrl.get(url)

  if (cached) {
    return cached
  }

  const store = fromApp($app => {
    const plugin = $app.use(Commands)

    if (url) {
      plugin.ensureLoaded(url)
    }

    return plugin.forUrl(url).$
  })

  commandsByUrl.set(url, store)

  return store
}

// Content outside a space has no url, and so no commands.
export const deriveValidCommands = (target: CommandScopeTarget): Readable<CommandReader[]> =>
  derived(deriveCommandsForUrl(target.url ?? ""), $commands =>
    $commands.filter(command => command.matches(target)),
  )

// Without a qualifier an invocation targets every definition whose trigger matches.
export const getCommandsForInvocation = (
  available: CommandReader[],
  invocation: Pick<CommandInvocation, "command" | "pubkey">,
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

// `matches` holds every definition the text targets, and `command` is the one shaping the input.
export type CommandDraft = {
  invocation: CommandInvocation
  command: CommandReader
  matches: CommandReader[]
  args: CommandArg[]
  // One entry per argument the text supplies, in order.
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
