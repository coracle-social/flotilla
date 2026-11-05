import {serveSqlite} from "@welshman/store/sqlite-serve"
import type {SqliteDatabase} from "@welshman/store"
import type {WrapItem} from "@welshman/net"

// How long the app keeps an event, or for good without keepUntil.
export type Retention = {
  id: string
  keepUntil?: number
  provenance: boolean
}

const transaction = (db: SqliteDatabase, f: () => void) => {
  db.exec("BEGIN")

  try {
    f()
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
}

export const extend = (db: SqliteDatabase) => {
  // Every event gets a row as it's stored, which keeps it only until the next sweep unless the
  // app says otherwise, so an event the app never judged doesn't stay for good.
  db.exec(`
    CREATE TABLE IF NOT EXISTS retention (
      event_id TEXT PRIMARY KEY,
      cached_at INTEGER NOT NULL,
      keep_until INTEGER,
      provenance INTEGER NOT NULL DEFAULT 0
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS retention_cached_at ON retention (cached_at);
    CREATE TRIGGER IF NOT EXISTS retention_events_insert AFTER INSERT ON events BEGIN
      INSERT OR REPLACE INTO retention (event_id, cached_at, keep_until)
      VALUES (new.id, unixepoch(), unixepoch());
    END;
    CREATE TRIGGER IF NOT EXISTS retention_events_delete AFTER DELETE ON events BEGIN
      DELETE FROM retention WHERE event_id = old.id;
    END;
    CREATE TABLE IF NOT EXISTS wraps (
      id TEXT PRIMARY KEY,
      rumor_id TEXT NOT NULL,
      item TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS wraps_rumor_id ON wraps (rumor_id);
    CREATE TABLE IF NOT EXISTS plugin (
      name TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (name, key)
    ) WITHOUT ROWID;
  `)

  return {
    retain: (retentions: Retention[]) =>
      transaction(db, () => {
        for (const {id, keepUntil, provenance} of retentions) {
          if (keepUntil === undefined) {
            db.run("UPDATE retention SET keep_until = NULL, provenance = ? WHERE event_id = ?", [
              Number(provenance),
              id,
            ])
          } else {
            db.run("UPDATE retention SET keep_until = ?, provenance = ? WHERE event_id = ?", [
              keepUntil,
              Number(provenance),
              id,
            ])
          }
        }
      }),
    // Evicting a delete brings back what it hides, and a rumor the wrap index names is never
    // unwrapped again, so neither goes while the other half is stored.
    getEvictable: (cachedBefore: number) =>
      db
        .all<{event_id: string}>(
          `SELECT r.event_id FROM retention r
           WHERE r.cached_at < ?
           AND (
             r.keep_until < unixepoch()
             OR (r.provenance = 1 AND NOT EXISTS (SELECT 1 FROM relays WHERE event_id = r.event_id))
           )
           AND NOT EXISTS (
             SELECT 1 FROM deletes d JOIN events e ON e.id = d.key WHERE d.id = r.event_id
           )
           AND NOT EXISTS (
             SELECT 1 FROM deletes d JOIN events e ON e.address = d.key WHERE d.id = r.event_id
           )
           AND NOT EXISTS (SELECT 1 FROM wraps w WHERE w.rumor_id = r.event_id)`,
          [cachedBefore],
        )
        .map(row => row.event_id),
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
    // The app's collections outside the repository, such as relay stats and decrypted plaintext.
    // A row's json goes out as it came in, for the app to judge when it reads it back.
    getPluginItems: (name: string): [string, string][] =>
      db
        .all<{key: string; value: string}>(`SELECT key, value FROM plugin WHERE name = ?`, [name])
        .map(row => [row.key, row.value]),
    putPluginItems: (name: string, items: [string, string][]) =>
      transaction(db, () => {
        for (const [key, value] of items) {
          db.run("INSERT OR REPLACE INTO plugin (name, key, value) VALUES (?, ?, ?)", [
            name,
            key,
            value,
          ])
        }
      }),
  }
}

serveSqlite(extend)
