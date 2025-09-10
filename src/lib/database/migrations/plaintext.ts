export const PlaintextMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS plaintext (key TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL) WITHOUT ROWID;`,
    ],
  },
]
