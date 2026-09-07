import {App} from "@capacitor/app"
import {Capacitor} from "@capacitor/core"
import {Keyboard} from "@capacitor/keyboard"
import {noop} from "@welshman/lib"

export const syncKeyboard = () => {
  if (!Capacitor.isPluginAvailable("Keyboard")) return noop

  const showListener = Keyboard.addListener("keyboardWillShow", () => {
    document.body.classList.add("keyboard-open")
  })

  const hideListener = Keyboard.addListener("keyboardWillHide", () => {
    document.body.classList.remove("keyboard-open")
  })

  // On Android, system-dismissing the IME during pause doesn't fire keyboardWillHide,
  // so on resume we force a hide to re-sync native insets and clear our CSS state.
  const resumeListener = App.addListener("appStateChange", ({isActive}) => {
    if (isActive) Keyboard.hide()
  })

  return () => {
    showListener.then(listener => listener.remove())
    hideListener.then(listener => listener.remove())
    resumeListener.then(listener => listener.remove())
    document.body.classList.remove("keyboard-open")
  }
}
