import {createConnection} from "node:net"
import {MINUTE, int, ms, sleep} from "@welshman/lib"
import {makeRelayAuth} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {ClientMessageType, isRelayAuth, isRelayOk} from "@welshman/net"
import type {ClientMessage} from "@welshman/net"
import {testUsersByPubkey} from "../keys"
import type {TestUser} from "../keys"
import {tenantNames, tenantUrl, tenants} from "./config"
import type {TenantName} from "./config"
import {describeDockerProblem, describeFailure, dockerCommand} from "./docker"
import {makeTestRelay} from "./testRelay"
import type {Backend, PublishOptions} from "./types"
import {connectToHost, port, requestHost} from "./transport"
import type {HostConnection} from "./transport"

// How long after a recreate chromium can still abort what a page has in flight.
const SETTLE = 2500

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

// How far the container's clock is from this host's, in seconds. Positive means the container is behind.
const getClockDrift = async (host: string) => {
  const {headers} = await requestHost(host, "GET", "/", {accept: "application/nostr+json"})

  if (headers.date) {
    return Math.round((Date.now() - new Date(headers.date).getTime()) / 1000)
  }
}

// Every backend accepts a nip-42 auth event within ten minutes of its own clock.
const describeClockDrift = (drift: number) => {
  const [minutes, direction] =
    drift > 0 ? [drift / 60, "behind"] : [Math.abs(drift) / 60, "ahead of"]

  return (
    `The relay container's clock is ${Math.round(minutes)} minutes ${direction} this host. ` +
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
    `Cannot publish as ${pubkey}: the relay authenticates every write, so seeded events must be ` +
      "signed by one of the test identities in e2e/harness/keys.ts",
  )
}

/** The relays every test runs against. One container serves a virtual relay per entry in `tenants`. */
export class RelayServer {
  // Every socket into the container is one this process opened, so this map also defines a url that is not a leak.
  relays = new Map(
    tenantNames.map(name => [
      tenantUrl(name),
      {connect: () => connectToHost(tenants[name]), host: tenants[name]},
    ]),
  )

  private sessions = new Map<string, HostConnection>()

  private started = false

  // Whether a container is up. `reset` is what creates one, so this stays false until it has run.
  private running = false

  // When the last recreate's interface churn stops being able to abort a request.
  private settledAt = 0

  constructor(readonly backend: Backend) {}

  // Verifies docker and prepares the image rather than bringing the container up, which reset does.
  start = async () => {
    if (this.started) {
      return
    }

    const problem = await describeDockerProblem()

    if (problem) {
      throw new Error(problem)
    }

    if (await isRelayPortTaken()) {
      throw new Error(
        `127.0.0.1:${port} is already in use, but the relay container publishes exactly that ` +
          "port and the harness talks to whatever answers there. This is a leftover container " +
          "from an interrupted run, or another copy of this suite running on the machine (under " +
          `any user). Free it before running — \`${dockerCommand} rm -f ` +
          `flotilla-e2e-${this.backend.name}-relay-1\` clears the one this project starts.`,
      )
    }

    await this.backend.prepare()

    this.started = true
  }

  relay = (name: TenantName) =>
    makeTestRelay({
      name,
      url: tenantUrl(name),
      publish: (event, options) => this.publish(tenantUrl(name), event, options),
      admit: async user => {
        await this.backend.admit?.(name, user)
      },
    })

  publish = async (url: string, event: SignedEvent, {as}: PublishOptions = {}) => {
    const relay = this.relays.get(url)

    if (!relay) {
      throw new Error(`Attempted to publish to ${url}, which is not one of this container's relays`)
    }

    const connection = await this.authenticate(relay.host, as ?? getTestUser(event.pubkey))
    const {ok, detail} = await this.send(connection, [ClientMessageType.Event, event], event.id)

    if (!ok) {
      throw new Error(`${this.backend.name} refused a kind ${event.kind} fixture: ${detail}`)
    }
  }

  // Recreating churns the host's network interfaces, and chromium aborts what it has in flight.
  reset = async () => {
    this.closeSessions()

    try {
      await this.backend.up()
    } catch (error) {
      await this.fail(describeFailure(error))
    }

    await this.waitForTenants()

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

      await this.backend.down()

      this.started = false
      this.running = false
    }
  }

  private fail = async (summary: string): Promise<never> => {
    const logs = await this.backend.logs()

    throw new Error(logs ? `${summary}\n\n${this.backend.name} said:\n${logs}` : summary)
  }

  private waitForTenants = async () => {
    const deadline = Date.now() + ms(30)

    while (Date.now() < deadline) {
      // A 404 means no relay is bound to that host yet, so the backend is still loading its relays.
      const isUp = await Promise.all(
        tenantNames.map(name =>
          requestHost(tenants[name], "GET", "/", {accept: "application/nostr+json"}).then(
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
      `${this.backend.name} did not answer as ${tenantNames.map(name => tenants[name]).join(" and ")} ` +
        "within 30 seconds.",
    )
  }

  // NIP-42 binds an identity to a connection, signed for the url transport.ts's headers rebuild.
  private authenticate = async (host: string, user: TestUser) => {
    const key = `${host} ${user.pubkey}`
    const session = this.sessions.get(key)

    if (session) {
      return session
    }

    const connection = connectToHost(host)
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
  private send = async (connection: HostConnection, message: ClientMessage, id: string) => {
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
