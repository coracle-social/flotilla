import {preferencesStorageProvider} from "@src/lib/storage"
import {synced} from "@welshman/store"

export const theme = synced({
  key: "theme",
  defaultValue: "dark",
  storage: preferencesStorageProvider,
})
