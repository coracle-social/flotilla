import {execFile} from "node:child_process"
import {createConnection} from "node:net"
import {chmod, cp, readdir, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {fileURLToPath} from "node:url"
import {promisify} from "node:util"
import {MINUTE, int, ms, sleep} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {makeRelayAuth} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {ClientMessageType, isRelayAuth, isRelayOk} from "@welshman/net"
import type {ClientMessage} from "@welshman/net"
import {testUsersByPubkey} from "../keys"
import type {TestUser} from "../keys"
import {tenantNames, tenantUrl, tenants} from "./config"
import type {TenantName} from "./config"
import {makeTestRelay} from "./testRelay"
import type {PublishOptions} from "./types"
import {connectToZooid, port, requestZooid} from "./transport"
import type {ZooidConnection} from "./transport"

// Pinned by digest so a spec runs against one zooid. ZOOID_IMAGE is how an unreleased build is tried.
const image =
  process.env.ZOOID_IMAGE ??
  "gitea.coracle.social/coracle/zooid:latest@sha256:7950843900cbb1c7c1f17de5524f6999badd1002cde94476855e90e67e0f2248"

// How long after a recreate chromium can still abort what a page has in flight.
const SETTLE = 2500

const composeFile = fileURLToPath(new URL("docker/compose.yaml", import.meta.url))

const configSource = fileURLToPath(new URL("docker/config", import.meta.url))

// zooid saves a relay's toml back on a nip-86 edit, so it is handed a copy rather than the repo's.
const configDir = join(tmpdir(), "flotilla-e2e-zooid-config")

const execFileAsync = promisify(execFile)

// execFile does not go through a shell, so a docker that exists only as an alias needs E2E_DOCKER.
const dockerCommand = process.env.E2E_DOCKER ?? "docker"

// Whether something already answers on the port the container publishes.
const isRelayPortTaken = () =>
  new Promise<boolean>(resolve => {
    const socket = createConnection({port, host: "127.0.0.1"})

    socket.setTimeout(1000)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => resolve(false))
  })

// The compose file names both without a default, so a call that left one out fails to interpolate.
const docker = (...args: string[]) =>
  execFileAsync(dockerCommand, args, {
    env: {...process.env, ZOOID_CONFIG: configDir, ZOOID_IMAGE: image},
  })

const compose = (...args: string[]) => docker("compose", "-f", composeFile, ...args)

// Why the container cannot be driven, or undefined when it can.
const probeDocker = async () => {
  try {
    await docker("compose", "version")

    return undefined
  } catch (error) {
    const {code, stderr} = Object(error) as {code?: string; stderr?: string}

    if (code === "ENOENT") {
      return (
        `\`${dockerCommand}\` is not on PATH for the test runner. If it works in your shell it is ` +
        "an alias or a function rather than an executable, which execFile cannot see: set " +
        "E2E_DOCKER to the real command, e.g. `E2E_DOCKER=podman pnpm test`."
      )
    }

    return (
      `\`${dockerCommand} compose version\` failed, so the daemon is likely not running. ` +
      (stderr?.trim() || String(error))
    )
  }
}

// How far the container's clock is from this host's, in seconds. Positive means the container is behind.
const getClockDrift = async (host: string) => {
  const {headers} = await requestZooid(host, "GET", "/", {accept: "application/nostr+json"})

  if (headers.date) {
    return Math.round((Date.now() - new Date(headers.date).getTime()) / 1000)
  }
}

// nip-42 accepts an auth event within ten minutes of the relay's own clock (nip42.go).
const describeClockDrift = (drift: number) => {
  const [minutes, direction] =
    drift > 0 ? [drift / 60, "behind"] : [Math.abs(drift) / 60, "ahead of"]

  return (
    `The zooid container's clock is ${Math.round(minutes)} minutes ${direction} this host. ` +
    "nip-42 allows ten either way, so the relay refuses every event the harness signs, and " +
    "will go on refusing them until the two agree. A container runtime's vm loses time while " +
    "the machine is asleep; restarting it resyncs the clock:\n\n" +
    "  podman: podman machine stop && podman machine start\n" +
    "  docker: restart Docker Desktop, or " +
    "`docker run --rm --privileged alpine hwclock -s`\n\n" +
    "Then confirm they agree — `podman machine ssh date -u`, or " +
    "`docker info --format '{{.SystemTime}}'`, against `date -u`."
  )
}

const getTestUser = (pubkey: string) => {
  const user = testUsersByPubkey.get(pubkey)

  if (user) {
    return user
  }

  throw new Error(
    `Cannot publish as ${pubkey}: zooid authenticates every write, so seeded events must be ` +
      "signed by one of the test identities in e2e/harness/keys.ts",
  )
}

let problem: Maybe<Promise<Maybe<string>>>

// Also written to the terminal, since a skip reason otherwise reaches only the html report.
export const describeDockerProblem = () =>
  (problem ??= probeDocker().then(reason => {
    if (reason) {
      console.warn(
        `\nThe e2e suite cannot drive a container, so every test will skip:\n  ${reason}\n`,
      )
    }

    return reason
  }))

/** The relay every test runs against. One container serves a virtual relay per entry in `tenants`. */
export class Zooid {
  // Every socket into the container is one this process opened, so this map also defines a url that is not a leak.
  relays = new Map(
    tenantNames.map(name => [
      tenantUrl(name),
      {connect: () => connectToZooid(tenants[name]), host: tenants[name]},
    ]),
  )

  private sessions = new Map<string, ZooidConnection>()

  private started = false

  // Whether a container is up. `reset` is what creates one, so this stays false until it has run.
  private running = false

  // When the last recreate's interface churn stops being able to abort a request.
  private settledAt = 0

  // Verifies docker rather than bringing the container up, which reset does. Repeat calls are free.
  start = async () => {
    if (this.started) {
      return
    }

    const problem = await describeDockerProblem()

    if (problem) {
      throw new Error(problem)
    }

    const hasImage = await docker("image", "inspect", image).then(
      () => true,
      () => false,
    )

    if (!hasImage) {
      await this.fetchImage()
    }

    if (await isRelayPortTaken()) {
      throw new Error(
        `127.0.0.1:${port} is already in use, but the zooid relay container publishes ` +
          "exactly that port and the harness talks to whatever answers there. This is a leftover " +
          "container from an interrupted run, or another copy of this suite running on the machine " +
          `(under any user). Free it before running — \`${dockerCommand} rm -f ` +
          "flotilla-e2e-zooid-relay-1` clears the one this project starts.",
      )
    }

    this.started = true
  }

  relay = (name: TenantName) =>
    makeTestRelay({
      name,
      url: tenantUrl(name),
      publish: (event, options) => this.publish(tenantUrl(name), event, options),
    })

  publish = async (url: string, event: SignedEvent, {as}: PublishOptions = {}) => {
    const relay = this.relays.get(url)

    if (!relay) {
      throw new Error(`Attempted to publish to ${url}, which is not one of this container's relays`)
    }

    const connection = await this.authenticate(relay.host, as ?? getTestUser(event.pubkey))
    const {ok, detail} = await this.send(connection, [ClientMessageType.Event, event], event.id)

    if (!ok) {
      throw new Error(`zooid refused a kind ${event.kind} fixture: ${detail}`)
    }
  }

  // Recreating churns the host's network interfaces, and chromium aborts what it has in flight.
  reset = async () => {
    this.closeSessions()

    await this.up()

    this.running = true
    this.settledAt = Date.now() + SETTLE
  }

  // The container the test about to run will use. Only the first test of a worker finds none.
  ensure = async () => {
    if (!this.running) {
      await this.reset()
    }
  }

  // As late as the wait can be left: teardown, the next test's fixtures and its seeding are inside it.
  settle = async () => {
    const remaining = this.settledAt - Date.now()

    if (remaining > 0) {
      await sleep(remaining)
    }
  }

  stop = async () => {
    if (this.started) {
      this.closeSessions()

      await compose("down")

      this.started = false
      this.running = false
    }
  }

  // A pull of a pinned reference can only produce the relay this suite was written against.
  private fetchImage = async () => {
    console.warn(`\nFetching the zooid image this suite is pinned to:\n  ${image}\n`)

    try {
      await docker("pull", image)
    } catch (error) {
      const {stderr} = Object(error) as {stderr?: string}

      throw new Error(
        `Could not fetch ${image}: ${stderr?.trim() || String(error)}\n\n` +
          `Fetch it by hand with \`${dockerCommand} pull ${image}\`, or point ZOOID_IMAGE at a ` +
          "zooid you built yourself.",
        {cause: error},
      )
    }
  }

  // Compose reports only that a container exited, so without this a startup failure has no reason.
  private logs = () =>
    compose("logs", "--no-color", "--tail", "50").then(
      ({stdout, stderr}) => [stdout, stderr].filter(Boolean).join("\n").trim(),
      () => "",
    )

  private fail = async (summary: string) => {
    const logs = await this.logs()

    throw new Error(logs ? `${summary}\n\nzooid said:\n${logs}` : summary)
  }

  // Storage is tmpfs with no volume mounted for it, so a new container is a new database.
  private up = async () => {
    // A fresh copy restores metadata a test edited through nip-86, and the container runs as uid 65532.
    await rm(configDir, {recursive: true, force: true})
    await cp(configSource, configDir, {recursive: true})
    await chmod(configDir, 0o777)

    for (const name of await readdir(configDir)) {
      await chmod(join(configDir, name), 0o666)
    }

    try {
      await compose("up", "-d", "--force-recreate", "--wait")
    } catch (error) {
      const {stderr} = Object(error) as {stderr?: string}

      await this.fail((stderr?.trim() || String(error)).split("\n").slice(-3).join("\n"))
    }

    const deadline = Date.now() + ms(30)

    while (Date.now() < deadline) {
      // A 404 means the dispatcher has no relay bound to that host yet, so the configs are still loading.
      const isUp = await Promise.all(
        tenantNames.map(name =>
          requestZooid(tenants[name], "GET", "/", {accept: "application/nostr+json"}).then(
            response => response.status === 200,
            () => false,
          ),
        ),
      ).then(results => results.every(Boolean))

      if (isUp) {
        const drift = await getClockDrift(tenants[tenantNames[0]])

        if (drift !== undefined && Math.abs(drift) > int(10, MINUTE)) {
          throw new Error(describeClockDrift(drift))
        }

        return
      }

      await sleep(200)
    }

    await this.fail(
      `zooid did not answer as ${tenantNames.map(name => tenants[name]).join(" and ")} within 30 ` +
        "seconds.",
    )
  }

  // NIP-42 binds an identity to a connection, and khatru rebuilds the signed url from transport.ts's headers.
  private authenticate = async (host: string, user: TestUser) => {
    const key = `${host} ${user.pubkey}`
    const session = this.sessions.get(key)

    if (session) {
      return session
    }

    const connection = connectToZooid(host)
    const [, challenge] = await connection.wait(isRelayAuth)
    const event = await user.signer.sign(makeRelayAuth(`wss://${host}/`, challenge))
    const {ok, detail} = await this.send(connection, [ClientMessageType.Auth, event], event.id)

    if (ok) {
      this.sessions.set(key, connection)

      return connection
    }

    const summary = `Failed to authenticate as ${user.name} on ${host}: ${detail}`
    const drift = await getClockDrift(host).catch(() => undefined)

    // Nearly always the clock: the signature is checked after the timestamp the relay compares against.
    if (drift !== undefined && Math.abs(drift) > int(10, MINUTE)) {
      throw new Error(`${summary}\n\n${describeClockDrift(drift)}`)
    }

    throw new Error(summary)
  }

  // Both the auth that opens a connection and every event written over it are answered with an OK.
  private send = async (connection: ZooidConnection, message: ClientMessage, id: string) => {
    connection.send(message)

    const [, , ok, detail] = await connection.wait(reply => isRelayOk(reply) && reply[1] === id)

    return {ok, detail}
  }

  private closeSessions = () => {
    for (const connection of this.sessions.values()) {
      connection.close()
    }

    this.sessions.clear()
  }
}
