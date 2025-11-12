import {kv} from "@app/core/storage"
import {synced} from "@welshman/store"

export const theme = synced({
  key: "theme",
  defaultValue: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  storage: kv,
})
