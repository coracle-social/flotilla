export const TrackerMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS tracker (id TEXT PRIMARY KEY, data TEXT NOT NULL);`],
  },
]
