import {transaction} from "@welshman/store"
import type {SqliteDatabase} from "@welshman/store"

// How long the app keeps an event, or for good without keepUntil.
export type Retention = {
  id: string
  keepUntil?: number
  provenance: boolean
}

// Every event gets a row as it's stored, which keeps it only until the next sweep unless the app
// says otherwise, so an event it never judged doesn't stay for good.
const SCHEMA = `
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
`

/** What the app keeps, and for how long, beside the events it stored. */
export const retention = (db: SqliteDatabase) => {
  db.exec(SCHEMA)

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
  }
}
