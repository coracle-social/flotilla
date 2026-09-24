import {name, repository, version} from "./context.mjs"
import {giteaPackage} from "./gitea.mjs"

// F-Droid rebuilds each tag and ships this apk, signed with our key, only if its own build matches
export const fdroidPackage = token =>
  giteaPackage({repository, token, name: `${name}-fdroid`, version})

export const unsignedApk = `${name}-fdroid-${version}-unsigned.apk`
export const signedApk = `${name}-fdroid-${version}.apk`

// CI publishes packages with its own token, since the job's gitea token can't
export const packageToken = process.env.GITEA_PACKAGE_TOKEN || process.env.GITEA_TOKEN
