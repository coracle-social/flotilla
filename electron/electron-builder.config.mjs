import {readFileSync} from "node:fs"

const {name, version, author} = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
)
const {appId, appName} = JSON.parse(
  readFileSync(new URL("generated/capacitor.config.json", import.meta.url), "utf8"),
)

/** @type {import('electron-builder').Configuration} */
export default {
  appId,
  productName: appName,
  executableName: name,
  buildVersion: version,
  extraMetadata: {
    name,
    version,
    author,
    productName: appName,
    description: appName,
    desktopName: `${appId}.desktop`,
  },
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  directories: {output: "dist", buildResources: "generated"},
  icon: "generated/icon.png",
  files: [
    "build/main.js",
    "app/**/*",
    "generated/**/*",
    "package.json",
    {from: "vendor/node_modules", to: "node_modules"},
  ],
  allowMissingDependencies: false,
  publish: {
    provider: "generic",
    url: "https://gitea.coracle.social/coracle/flotilla/releases/download/latest/",
  },
  toolsets: {appimage: "1.0.3"},
  linux: {
    target: [{target: "AppImage", arch: ["x64"]}],
    category: "Network",
    syncDesktopName: true,
  },
  win: {target: [{target: "nsis", arch: ["x64"]}], signExecutable: false},
  mac: {
    target: [
      {target: "dmg", arch: ["x64", "arm64"]},
      {target: "zip", arch: ["x64", "arm64"]},
    ],
    category: "public.app-category.social-networking",
  },
  dmg: {sign: false},
}
