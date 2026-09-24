import {readFile, readdir} from "node:fs/promises"
import {join, resolve} from "node:path"
import {HOUR, ago, ms, now, sleep} from "@welshman/lib"
import {appStore} from "../lib/appstore.mjs"
import {followUps, missingEnv, notes, root, version} from "../lib/context.mjs"
import {run} from "../lib/shell.mjs"

const editableStates = [
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
]

export default {
  name: "ios",
  title: "Upload the iOS build and attach it to its App Store version",
  missing: () => [
    ...(process.platform === "darwin" ? [] : ["macOS with Xcode"]),
    ...missingEnv("ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_PATH"),
  ],
  setup: [
    "App Store Connect -> Users and Access -> Integrations -> App Store Connect API, generate a",
    "team key with the App Manager role. Download the .p8 (only offered once), keep it outside",
    "the repo, and set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH in .env.local.",
  ],
  run: async () => {
    const {appId} = JSON.parse(
      await readFile(join(root, "ios/App/App/capacitor.config.json"), "utf-8"),
    )
    const pbxproj = await readFile(join(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf-8")
    const buildNumber = pbxproj.match(/CURRENT_PROJECT_VERSION = (\d+);/)[1]
    const store = await appStore({
      keyId: process.env.ASC_KEY_ID,
      issuerId: process.env.ASC_ISSUER_ID,
      keyPath: resolve(root, process.env.ASC_KEY_PATH),
    })
    const query = params => new URLSearchParams(params).toString()
    const [app] = (await store.api("GET", `/v1/apps?${query({"filter[bundleId]": appId})}`)).data

    if (!app) {
      throw new Error(`App Store Connect has no app with the bundle id ${appId}`)
    }

    const findBuild = async () =>
      (
        await store.api(
          "GET",
          `/v1/builds?${query({
            "filter[app]": app.id,
            "filter[version]": buildNumber,
            "filter[preReleaseVersion.version]": version,
          })}`,
        )
      ).data[0]

    // App Store Connect never takes a build number twice, so a rerun uses the build already there
    if (!(await findBuild())) {
      await run("npx", ["cap", "build", "ios"], {cwd: root})

      const directory = join(root, "ios/App/output")
      const ipa = (await readdir(directory)).find(file => file.endsWith(".ipa"))

      if (!ipa) {
        throw new Error(`No ipa was exported to ${directory}`)
      }

      await store.upload(join(directory, ipa))
    }

    const started = now()
    let build = await findBuild()

    while (build?.attributes.processingState !== "VALID") {
      if (["INVALID", "FAILED"].includes(build?.attributes.processingState)) {
        throw new Error(
          `Build ${buildNumber} failed processing; bump CURRENT_PROJECT_VERSION and run pnpm release:local ios`,
        )
      }

      if (started < ago(HOUR)) {
        throw new Error(
          `Build ${buildNumber} is still processing after an hour; rerun this step later`,
        )
      }

      console.log(`Waiting for build ${buildNumber} to finish processing`)
      await sleep(ms(30))
      build = await findBuild()
    }

    let [appStoreVersion] = (
      await store.api(
        "GET",
        `/v1/apps/${app.id}/appStoreVersions?${query({
          "filter[platform]": "IOS",
          "filter[versionString]": version,
        })}`,
      )
    ).data

    if (!appStoreVersion) {
      appStoreVersion = (
        await store.api("POST", "/v1/appStoreVersions", {
          data: {
            type: "appStoreVersions",
            attributes: {platform: "IOS", versionString: version},
            relationships: {app: {data: {type: "apps", id: app.id}}},
          },
        })
      ).data
    }

    const {appVersionState} = appStoreVersion.attributes

    if (editableStates.includes(appVersionState)) {
      const localizations = (
        await store.api(
          "GET",
          `/v1/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations`,
        )
      ).data

      for (const localization of localizations) {
        await store.api("PATCH", `/v1/appStoreVersionLocalizations/${localization.id}`, {
          data: {
            type: "appStoreVersionLocalizations",
            id: localization.id,
            attributes: {whatsNew: notes.slice(0, 4000)},
          },
        })
      }

      await store.api("PATCH", `/v1/appStoreVersions/${appStoreVersion.id}/relationships/build`, {
        data: {type: "builds", id: build.id},
      })

      followUps.push(
        `App Store Connect: ${version} has build ${buildNumber} and its release notes, submit it for review at https://appstoreconnect.apple.com`,
      )
    } else {
      const attached = await store.api("GET", `/v1/appStoreVersions/${appStoreVersion.id}/build`)

      if (attached.data?.id !== build.id) {
        throw new Error(
          `${version} is ${appVersionState} with a build other than ${buildNumber}; change it in App Store Connect`,
        )
      }

      console.log(`${version} is already ${appVersionState} with build ${buildNumber}`)
    }
  },
}
