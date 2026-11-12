import {CLIENT_AUTH} from "@welshman/util"
import {ClientMessageType, RelayMessageType} from "@welshman/net"
import {expect, getTranscript, roomPath, test, users} from "../harness"

test("authenticates over nip-42 before a members-only relay serves anything", async ({
  seed,
  as,
}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("backroom", {name: "Backroom"})
    space.join(user.alice, "backroom")
    space.message(user.alice, "backroom", "the secret handshake")
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "backroom"))

  await expect(page.getByText("the secret handshake")).toBeVisible()

  const transcript = getTranscript(page.context()).filter(entry => entry.url === url)
  const challengedAt = transcript.findIndex(
    ({direction, message}) => direction === "toClient" && message[0] === RelayMessageType.Auth,
  )
  const authenticatedAt = transcript.findIndex(
    ({direction, message}) => direction === "toRelay" && message[0] === ClientMessageType.Auth,
  )
  const firstEventAt = transcript.findIndex(
    ({direction, message}) => direction === "toClient" && message[0] === RelayMessageType.Event,
  )

  expect(challengedAt).toBeGreaterThanOrEqual(0)
  expect(authenticatedAt).toBeGreaterThan(challengedAt)
  expect(transcript[authenticatedAt].message[1]).toMatchObject({
    kind: CLIENT_AUTH,
    pubkey: users.alice.pubkey,
  })

  // Until the client proves who it is, the relay hands it nothing at all.
  expect(firstEventAt).toBeGreaterThan(authenticatedAt)
})
