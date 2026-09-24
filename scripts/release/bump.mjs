#!/usr/bin/env node
// Bumps the version in package.json and syncs it to android and ios via
// capacitor-set-version. Android and iOS build numbers have diverged
// historically, so each platform keeps its own counter, incremented only when
// its marketing version actually changes (re-running with the same version is
// a no-op).
import {readFileSync, writeFileSync} from "node:fs"
import {setAndroidVersionAndBuild} from "capacitor-set-version/dist/common/utils-android.js"
import {setIOSVersionAndBuild} from "capacitor-set-version/dist/common/utils-ios.js"

const arg = process.argv[2]

const pkg = JSON.parse(readFileSync("package.json", "utf-8"))

let version
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  version = arg
} else {
  const [major, minor, patch] = pkg.version.split(".").map(Number)
  if (arg === "major") {
    version = `${major + 1}.0.0`
  } else if (arg === "minor") {
    version = `${major}.${minor + 1}.0`
  } else if (arg === "patch") {
    version = `${major}.${minor}.${patch + 1}`
  } else {
    console.error("Usage: pnpm bump <major|minor|patch|x.y.z>")
    process.exit(1)
  }
}

const gradle = readFileSync("android/app/build.gradle", "utf-8")
const pbxproj = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf-8")

const androidVersion = gradle.match(/versionName "(.+)"/)[1]
const androidBuild = Number(gradle.match(/versionCode (\d+)/)[1])
const iosVersion = pbxproj.match(/MARKETING_VERSION = (.+);/)[1]
const iosBuild = Number(pbxproj.match(/CURRENT_PROJECT_VERSION = (\d+);/)[1])

pkg.version = version
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")

const nextAndroidBuild = version === androidVersion ? androidBuild : androidBuild + 1
const nextIosBuild = version === iosVersion ? iosBuild : iosBuild + 1

setAndroidVersionAndBuild(".", version, nextAndroidBuild)
setIOSVersionAndBuild(".", version, nextIosBuild)

console.log(`android: ${version} (${nextAndroidBuild})`)
console.log(`ios: ${version} (${nextIosBuild})`)
