import {createHash} from "node:crypto"
import {getPubkey} from "@welshman/util"
import {Nip01Signer} from "@welshman/signer"

export type TestUser = {
  name: string
  secret: string
  pubkey: string
  signer: Nip01Signer
}

// zooid refuses an event whose author is not the authenticated pubkey, so seeding looks the author up here.
export const testUsersByPubkey = new Map<string, TestUser>()

const makeUser = (name: string, secret: string): TestUser => {
  const user = {name, secret, pubkey: getPubkey(secret), signer: new Nip01Signer(secret)}

  testUsersByPubkey.set(user.pubkey, user)

  return user
}

// Stable across runs, so a pubkey can be asserted on and its leading nibbles name an author in a diff.
export const users = {
  alice: makeUser("alice", "a11ce00000000000000000000000000000000000000000000000000000000001"),
  bob: makeUser("bob", "b0b0000000000000000000000000000000000000000000000000000000000002"),
  carol: makeUser("carol", "ca20100000000000000000000000000000000000000000000000000000000003"),
  admin: makeUser("admin", "ad31100000000000000000000000000000000000000000000000000000000004"),
}

// secp256k1's group order. A secret is a scalar in [1, n), so the digest below is reduced into it.
const CURVE_ORDER = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141")

/** An identity beyond the four above, derived from its name so its pubkey is stable, and registered on minting. */
export const makeTestUser = (name: string) => {
  const digest = BigInt("0x" + createHash("sha256").update(name).digest("hex"))
  const secret = ((digest % (CURVE_ORDER - 1n)) + 1n).toString(16).padStart(64, "0")

  return makeUser(name, secret)
}
