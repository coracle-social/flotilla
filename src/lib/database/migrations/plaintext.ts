export const PlaintextMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS plaintext (key TEXT PRIMARY KEY, data TEXT NOT NULL)`],
  },
]
