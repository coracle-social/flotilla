import {transaction} from "@welshman/store"
import type {SqliteDatabase} from "@welshman/store"
import type {Maybe} from "@welshman/lib"

// The app's collections outside the repository, such as relay stats and decrypted plaintext.
// A row's json goes out as it came in, for the app to judge when it reads it back.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS plugin (
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (name, key)
  ) WITHOUT ROWID;
`

/** A row per item of each plugin the app keeps, with `undefined` for one it no longer holds. */
export type PluginItems = [key: string, value: Maybe<string>][]

export const plugins = (db: SqliteDatabase) => {
  db.exec(SCHEMA)

  return {
    getPluginItems: (name: string): [string, string][] =>
      db
        .all<{key: string; value: string}>(`SELECT key, value FROM plugin WHERE name = ?`, [name])
        .map(row => [row.key, row.value]),
    putPluginItems: (name: string, items: PluginItems) =>
      transaction(db, () => {
        for (const [key, value] of items) {
          if (value === undefined) {
            db.run("DELETE FROM plugin WHERE name = ? AND key = ?", [name, key])
          } else {
            db.run("INSERT OR REPLACE INTO plugin (name, key, value) VALUES (?, ?, ?)", [
              name,
              key,
              value,
            ])
          }
        }
      }),
  }
}
