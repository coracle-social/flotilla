import {transaction} from "@welshman/store"
import type {SqliteDatabase} from "@welshman/store"
import type {WrapItem} from "@welshman/net"

// A wrap the index names is never unwrapped again, so the rumors it points at have to come with it
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS wraps (
    id TEXT PRIMARY KEY,
    rumor_id TEXT NOT NULL,
    item TEXT NOT NULL
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS wraps_rumor_id ON wraps (rumor_id);
`

/** The `WrapManager`'s index, which spares the app unwrapping a stored wrap a second time. */
export const wraps = (db: SqliteDatabase) => {
  db.exec(SCHEMA)

  return {
    getWraps: (): WrapItem[] =>
      db.all<{item: string}>("SELECT item FROM wraps").map(row => JSON.parse(row.item)),
    putWraps: (items: WrapItem[]) =>
      transaction(db, () => {
        for (const item of items) {
          db.run("INSERT OR REPLACE INTO wraps (id, rumor_id, item) VALUES (?, ?, ?)", [
            item.id,
            item.rumorId,
            JSON.stringify(item),
          ])
        }
      }),
    deleteWraps: (ids: string[]) =>
      db.run("DELETE FROM wraps WHERE id IN (SELECT value FROM json_each(?))", [
        JSON.stringify(ids),
      ]),
  }
}
