import {copyFile, mkdir, mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {run} from "./shell.mjs"

export const uploadToAppStore = async ({ipa, keyId, issuerId, keyPath}) => {
  // altool only reads the api key from a `private_keys` directory beside its working directory or
  // under $HOME, so give it a private one rather than leaving the key in the repo or home dir.
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
}
