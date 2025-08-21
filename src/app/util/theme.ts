import {synced, localStorageProvider} from "@welshman/store"

export const theme = synced({
  key: "theme",
  defaultValue: "dark",
  storage: localStorageProvider,
})
