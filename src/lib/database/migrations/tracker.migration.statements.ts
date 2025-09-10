export const TrackerMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS tracker (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL) WITHOUT ROWID;`,
    ],
  },
]
