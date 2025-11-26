import {Capacitor} from "@capacitor/core"
import {Keyboard} from "@capacitor/keyboard"
import {noop} from "@welshman/lib"

export const syncKeyboard = () => {
  if (!Capacitor.isNativePlatform()) return noop

  const showListener = Keyboard.addListener("keyboardWillShow", () => {
    document.body.classList.add("keyboard-open")
  })

  const hideListener = Keyboard.addListener("keyboardWillHide", () => {
    document.body.classList.remove("keyboard-open")
  })

  return () => {
    showListener.then(listener => listener.remove())
    hideListener.then(listener => listener.remove())
    document.body.classList.remove("keyboard-open")
  }
}
