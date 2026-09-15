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

const image = "gitea.coracle.social/coracle/zooid:latest"

// How long after a recreate chromium can still abort what a page has in flight. Every netlink
// event a create-and-destroy produces lands before `compose up --wait` returns — measured at 26 of
// them, all of them within a second, none after — but chromium coalesces interface changes for up
// to two seconds before acting on one, so the abort arrives well after the harness has moved on.
const SETTLE = 2500

const composeFile = fileURLToPath(new URL("docker/compose.yaml", import.meta.url))

const configSource = fileURLToPath(new URL("docker/config", import.meta.url))

// What the container mounts as /app/config. zooid saves a relay's toml back whenever a nip-86 call
// edits that relay's name, description or icon. A read-only mount fails those calls, and mounting
// the repo's own directory would leave one test rewriting the fixtures the rest read, so it is
// handed a copy. The image is distroless, so the copy is staged here rather than in an entrypoint.
const configDir = join(tmpdir(), "flotilla-e2e-zooid-config")

const execFileAsync = promisify(execFile)

// execFile does not go through a shell, so a `docker` that exists only as an alias or a function is
// invisible to it however well it works when typed. Name the executable to drive with E2E_DOCKER in
// that case.
const dockerCommand = process.env.E2E_DOCKER ?? "docker"

// Whether something already answers on the port the container publishes, asked before this run
// brings its own up.
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

// Every invocation carries ZOOID_CONFIG, `down` included. The compose file names it without a
// default, so a call that left it out fails to interpolate rather than quietly mounting something
// else.
const docker = (...args: string[]) =>
  execFileAsync(dockerCommand, args, {env: {...process.env, ZOOID_CONFIG: configDir}})

const compose = (...args: string[]) => docker("compose", "-f", composeFile, ...args)

// Why the container cannot be driven, or undefined when it can. A cli that is not on this process's
// PATH and a daemon that is not running need different answers, so they are reported apart rather
// than as one boolean.
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

// How far the container's clock is from this host's, in seconds, read off the Date header of the
// relay's own http answer. Positive means the container is behind, so an event the harness has just
// signed looks like it comes from the future.
const getClockDrift = async (host: string) => {
  const {headers} = await requestZooid(host, "GET", "/", {accept: "application/nostr+json"})

  if (headers.date) {
    return Math.round((Date.now() - new Date(headers.date).getTime()) / 1000)
  }
}

// nip-42 accepts an auth event within ten minutes of the relay's own clock (nip42.go), and under a
// container runtime's vm the two clocks belong to different machines. The relay's own one-line
// detail says nothing about how to fix that.
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

  if (user) return user

  throw new Error(
    `Cannot publish as ${pubkey}: zooid authenticates every write, so seeded events must be ` +
      "signed by one of the test identities in e2e/harness/keys.ts",
  )
}

let problem: Maybe<Promise<Maybe<string>>>

// Asked once a worker, since docker does not come and go mid-run. The answer is also written to the
// terminal, because a skip reason otherwise reaches only the html report.
export const describeDockerProblem = () =>
  (problem ??= probeDocker().then(reason => {
    if (reason) {
      console.warn(
        `\nThe e2e suite cannot drive a container, so every test will skip:\n  ${reason}\n`,
      )
    }

    return reason
  }))

/**
 * The relay every test runs against. One zooid container on loopback serves a virtual relay per
 * entry in `tenants`, and each relay's policy is its toml in docker/config, the only place policy
 * is written down. A scenario describes what is on a relay, never what the relay is.
 */
export class Zooid {
  // Every socket into the container, the client's and seeding's alike, is one this process opened,
  // so this map is also the definition of a url that is not a leak.
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

  // Verifies docker rather than bringing the container up, which `reset` does. Repeat calls are
  // free, so the fixture can call this per test.
  start = async () => {
    if (this.started) return

    const problem = await describeDockerProblem()

    if (problem) {
      throw new Error(problem)
    }

    const hasImage = await docker("image", "inspect", image).then(
      () => true,
      () => false,
    )

    if (!hasImage) {
      throw new Error(
        `The zooid image ${image} is not present locally. Fetch it with ` +
          `\`${dockerCommand} pull ${image}\`, or build it from a zooid checkout with ` +
          `\`${dockerCommand} build -t ${image} .\`.`,
      )
    }

    if (await isRelayPortTaken()) {
      throw new Error(
        `127.0.0.1:${port} is already in use, but the zooid relay container publishes ` +
          "exactly that port and the harness talks to whatever answers there. This is a leftover " +
          "container from an interrupted run, or another copy of this suite running on the machine " +
          `(under any user). Free it before running — \`${dockerCommand} compose -f ` +
          "e2e/harness/zooid/docker/compose.yaml down\` clears one this project started.",
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

  // Leaves a fresh container for whoever runs next. Recreating one churns the host's network
  // interfaces — a veth pair torn down and rebuilt, the project's bridge losing carrier with it —
  // and chromium aborts every request it has in flight when it acts on that, which reaches the app
  // as a route chunk that failed to import and, with `ssr = false`, a 500 page. So this is called
  // from teardown rather than setup, and everything after it counts towards `settle` below.
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

  // Waited out before a page is opened, which is as late as it can be left: teardown, the next
  // test's fixtures and its seeding are all inside the window already, so most tests pay nothing
  // here.
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

  // Whatever the relay wrote before it died. Compose reports only that a container exited, so
  // without this a startup failure is a status code and no reason.
  private logs = () =>
    compose("logs", "--no-color", "--tail", "50").then(
      ({stdout, stderr}) => [stdout, stderr].filter(Boolean).join("\n").trim(),
      () => "",
    )

  private fail = async (summary: string) => {
    const logs = await this.logs()

    throw new Error(logs ? `${summary}\n\nzooid said:\n${logs}` : summary)
  }

  // Storage is tmpfs with no volume mounted for it, so a new container is a new database and
  // recreating is what makes this a reset.
  private up = async () => {
    // A fresh copy on every recreate is what restores relay metadata a test edited through nip-86.
    // The modes are permissive because the container runs as uid 65532 while the copy belongs to
    // whoever ran the suite, and a runtime that keeps host ownership leaves zooid unable to write
    // the file it was told to save.
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
      // A 404 means the dispatcher has no relay bound to that host yet, so the configs are still
      // loading. Anything a relay itself answers means every tenant is ready.
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

  // NIP-42 binds an identity to a connection, so each test user seeds over its own, per relay. The
  // url signed into the auth event is the one the client uses, since that is what khatru rebuilds
  // from the headers transport.ts sends.
  private authenticate = async (host: string, user: TestUser) => {
    const key = `${host} ${user.pubkey}`
    const session = this.sessions.get(key)

    if (session) return session

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

    // Nearly always the clock rather than the key. Every identity here is one zooid's toml names,
    // and the signature is checked after the timestamp the relay compares against its own.
    if (drift !== undefined && Math.abs(drift) > int(10, MINUTE)) {
      throw new Error(`${summary}\n\n${describeClockDrift(drift)}`)
    }

    throw new Error(summary)
  }

  // Both halves of seeding, the auth that opens a connection and every event written over it, are
  // answered with an OK naming the event that was sent.
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
