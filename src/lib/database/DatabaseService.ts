import type {Unsubscriber} from "svelte/store"

export type DatabaseService = {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
}
