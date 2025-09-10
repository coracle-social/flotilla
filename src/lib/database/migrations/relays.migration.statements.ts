export const RelaysMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS relays (url TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL) WITHOUT ROWID;`,
    ],
  },
]
