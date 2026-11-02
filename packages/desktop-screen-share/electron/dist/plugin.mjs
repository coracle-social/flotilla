import {app, desktopCapturer, session, systemPreferences} from "electron"

let pendingSelection

const isMac = () => process.platform === "darwin"

// Wayland hands capture to the portal, which runs its own picker.
const isWayland = () =>
  process.platform === "linux" &&
  process.env.XDG_SESSION_TYPE === "wayland" &&
  Boolean(process.env.WAYLAND_DISPLAY)

const isScreenAccessDenied = () =>
  isMac() && ["denied", "restricted"].includes(systemPreferences.getMediaAccessStatus("screen"))

const screenAccessError = () => {
  const error = new Error("Screen recording access is blocked")
  error.code = "screen-access-denied"
  return error
}

const getSources = thumbnailSize =>
  desktopCapturer.getSources({types: ["screen", "window"], thumbnailSize})

const mapSource = source => ({
  id: source.id,
  name: source.name,
  type: source.id.startsWith("screen:") ? "screen" : "window",
  thumbnail: source.thumbnail.toDataURL(),
})

const takePendingSelection = () => {
  const selection = pendingSelection

  pendingSelection = undefined

  if (selection?.expiresAt > Date.now()) {
    return selection.id
  }
}

const onDisplayMediaRequest = async (_request, callback) => {
  try {
    const id = takePendingSelection()
    const sources = await getSources({width: 0, height: 0})

    if (id) {
      const source = sources.find(candidate => candidate.id === id)
      callback(source ? {video: source} : undefined)
    } else if (isWayland() && sources.length === 1) {
      callback({video: sources[0]})
    } else {
      callback(undefined)
    }
  } catch (error) {
    console.error("Could not handle display media request", error)
    callback(undefined)
  }
}

export class DesktopScreenShare {
  static __capacitorElectronPlugin = {
    name: "DesktopScreenShare",
    methods: ["getSources", "select"],
  }

  load() {
    void app
      .whenReady()
      .then(() => session.defaultSession.setDisplayMediaRequestHandler(onDisplayMediaRequest))
  }

  async getSources() {
    if (isScreenAccessDenied()) {
      throw screenAccessError()
    }

    if (isWayland()) {
      return {requiresPicker: false, sources: []}
    }

    try {
      const sources = await getSources({width: 320, height: 180})

      return {requiresPicker: true, sources: sources.map(mapSource)}
    } catch (error) {
      throw isScreenAccessDenied() ? screenAccessError() : error
    }
  }

  async select({id}) {
    if (!id) {
      throw new Error("A screen-share source id is required")
    }

    pendingSelection = {id, expiresAt: Date.now() + 15_000}
  }
}
