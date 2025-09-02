import {synced} from "@src/lib/storage"
import {localStorageProvider} from "@welshman/store"

export const theme = await synced({
  key: "theme",
  defaultValue: "dark",
  storage: localStorageProvider,
})
