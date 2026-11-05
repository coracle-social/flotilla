import {serveSqlite} from "@welshman/store/sqlite-serve"
import type {SqliteDatabase} from "@welshman/store"
import {plugins} from "@app/core/database.plugins"
import {retention} from "@app/core/database.retention"
import {wraps} from "@app/core/database.wraps"

/** The tables and methods flotilla keeps beside the engine's, served by the same worker. */
export const extend = (db: SqliteDatabase) => ({
  ...retention(db),
  ...wraps(db),
  ...plugins(db),
})

serveSqlite(extend)
