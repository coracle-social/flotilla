import {app} from "electron"

export class DesktopWindow {
  static __capacitorElectronPlugin = {name: "DesktopWindow", methods: ["show"]}

  window

  load() {
    app.on("browser-window-created", (_event, window) => {
      this.window = window
    })
  }

  async show() {
    if (!this.window || this.window.isDestroyed()) {
      throw new Error("The application window is closed")
    }
    if (this.window.isMinimized()) {
      this.window.restore()
    }
    this.window.show()
    this.window.focus()
  }
}
