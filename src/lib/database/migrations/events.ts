export const EventsMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL) WITHOUT ROWID;`,
    ],
  },
]
