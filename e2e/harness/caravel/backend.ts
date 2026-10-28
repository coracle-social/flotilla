import {fileURLToPath} from "node:url"
import {ms, now, parseJson, sleep} from "@welshman/lib"
import {makeHttpAuth, makeHttpAuthHeader} from "@welshman/util"
import {users} from "../keys"
import {tenantNames, tenants} from "../relay/config"
import type {TenantName} from "../relay/config"
import {
  composeLogs,
  describeFailure,
  docker,
  hasImage,
  makeCompose,
  pullImage,
} from "../relay/docker"
import {requestHost} from "../relay/transport"
import type {Backend} from "../relay/types"
import {memberMethods, relaySettings} from "./config"

// A checkout beside this one, on the monolith branch, which is where caravel serves relays itself.
const source =
  process.env.CARAVEL_SOURCE ?? fileURLToPath(new URL("../../../../caravel", import.meta.url))

const image = process.env.CARAVEL_IMAGE ?? "localhost/flotilla-e2e-caravel:latest"

// API_URL's host in docker/compose.yaml.
const apiHost = "api.test"

const compose = makeCompose(fileURLToPath(new URL("docker/compose.yaml", import.meta.url)), {
  CARAVEL_IMAGE: image,
})

// Rebuilt every run so a spec meets the caravel the checkout holds. An unchanged one is all cache.
const build = async () => {
  if (!(await hasImage(image))) {
    console.warn(
      `\nBuilding caravel from ${source}. A cold build compiles the whole workspace, which takes ` +
        "several minutes.\n",
    )
  }

  try {
    await docker("build", "--quiet", "--tag", image, source)
  } catch (error) {
    throw new Error(
      `Could not build caravel from ${source}: ${describeFailure(error)}\n\nPoint CARAVEL_SOURCE ` +
        "at a caravel checkout on the monolith branch, or CARAVEL_IMAGE at an image built from one.",
      {cause: error},
    )
  }
}

// The migrations run before caravel binds its port, so an answer here means the schema is in place.
const waitForHealth = async () => {
  const deadline = Date.now() + ms(30)

  while (Date.now() < deadline) {
    const response = await requestHost(apiHost, "GET", "/healthz", {}).catch(() => undefined)

    if (response?.status === 200) {
      return
    }

    await sleep(200)
  }

  throw new Error("caravel did not answer /healthz within 30 seconds.")
}

const request = async (host: string, path: string, headers: Record<string, string>, body = "") => {
  const response = await requestHost(host, "POST", path, headers, Buffer.from(body))
  const text = response.body.toString()

  if (response.status >= 300) {
    throw new Error(`caravel refused POST ${path} on ${host} with ${response.status}: ${text}`)
  }

  return text
}

// A nip-86 call as the owner, signed for the url caravel rebuilds from the Host header.
const manage = async (name: TenantName, method: string, params: string[]) => {
  const host = tenants[name]
  const body = JSON.stringify({method, params})
  const auth = await users.admin.signer.sign(await makeHttpAuth(`https://${host}/`, "POST", body))
  const headers = {
    "content-type": "application/nostr+json+rpc",
    authorization: makeHttpAuthHeader(auth),
  }
  const reply = parseJson<{error?: string}>(await request(host, "/", headers, body))

  if (reply?.error) {
    throw new Error(`caravel refused ${method} on ${host}: ${reply.error}`)
  }
}

// admin is the tenant and owns every relay, as it owns every toml in zooid/docker/config.
const provision = async () => {
  // POST /tenants creates a Stripe customer, so the tenant is written straight into the database.
  await compose(
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "caravel",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "INSERT INTO tenant (pubkey, created_at, stripe_customer_id) " +
      `VALUES ('${users.admin.pubkey}', ${now()}, 'cus_flotilla_e2e')`,
  )

  const auth = await users.admin.signer.sign(
    await makeHttpAuth(`http://${apiHost}/session`, "POST"),
  )
  const session = parseJson<{data: {token: string}}>(
    await request(apiHost, "/session", {authorization: makeHttpAuthHeader(auth)}),
  )
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${session?.data.token}`,
  }

  for (const name of tenantNames) {
    const [subdomain, ...domain] = tenants[name].split(".")

    // The free plan has nothing to bill, and caps a relay at ten members.
    await request(
      apiHost,
      "/relays",
      headers,
      JSON.stringify({
        tenant_pubkey: users.admin.pubkey,
        subdomain,
        zooid_domain: domain.join("."),
        plan_id: "free",
        ...relaySettings[name],
      }),
    )
  }
}

/** caravel serves every relay from one process and one Postgres, each a row the api creates. */
export const caravel: Backend = {
  name: "caravel",
  prepare: async () => {
    if (process.env.CARAVEL_IMAGE) {
      if (!(await hasImage(image))) {
        await pullImage(image, "CARAVEL_IMAGE")
      }
    } else {
      await build()
    }
  },
  up: async () => {
    await compose("up", "-d", "--force-recreate", "--wait")
    await waitForHealth()
    await provision()
  },
  down: async () => {
    await compose("down")
  },
  logs: () => composeLogs(compose),
  admit: async (name, user) => {
    for (const method of memberMethods[name] ?? []) {
      // caravel refuses to grant the owner a method, since it holds every one already.
      if (user.pubkey !== users.admin.pubkey) {
        await manage(name, "assignmethod", [user.pubkey, method])
      }
    }
  },
}
