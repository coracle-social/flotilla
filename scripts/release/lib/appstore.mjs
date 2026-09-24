import {sign} from "node:crypto"
import {copyFile, mkdir, mkdtemp, readFile, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {MINUTE, int, now} from "@welshman/lib"
import {run} from "./shell.mjs"

const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url")

export const appStore = async ({keyId, issuerId, keyPath}) => {
  const key = await readFile(keyPath, "utf-8")

  // Tokens live at most 20 minutes and waiting on a build can take longer, so each call signs anew
  const token = () => {
    const header = encode({alg: "ES256", kid: keyId, typ: "JWT"})
    const payload = encode({
      iss: issuerId,
      iat: now(),
      exp: now() + int(15, MINUTE),
      aud: "appstoreconnect-v1",
    })
    const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
      key,
      dsaEncoding: "ieee-p1363",
    })

    return `${header}.${payload}.${signature.toString("base64url")}`
  }

  const api = async (method, path, body) => {
    const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(body ? {"Content-Type": "application/json"} : {}),
      },
      body: body && JSON.stringify(body),
    })

    if (response.status === 204) {
      return undefined
    }

    const result = await response.json()

    if (!response.ok) {
      const details = result.errors?.map(error => error.detail ?? error.title).join("; ")

      throw new Error(`App Store Connect: ${details ?? JSON.stringify(result)}`)
    }

    return result
  }

  return {
    api,

    upload: async ipa => {
      // altool only reads the api key from a `private_keys` directory beside its working directory
      // or under $HOME, so give it a private one rather than leaving the key in the repo or home dir
      const directory = await mkdtemp(join(tmpdir(), "flotilla-appstore-"))

      try {
        await mkdir(join(directory, "private_keys"))
        await copyFile(keyPath, join(directory, "private_keys", `AuthKey_${keyId}.p8`))

        await run(
          "xcrun",
          [
            "altool",
            "--upload-app",
            "-f",
            ipa,
            "-t",
            "ios",
            "--apiKey",
            keyId,
            "--apiIssuer",
            issuerId,
          ],
          {cwd: directory},
        )
      } finally {
        await rm(directory, {recursive: true, force: true})
      }
    },
  }
}
