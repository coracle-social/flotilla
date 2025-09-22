export const FreshnessMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS freshness (key TEXT PRIMARY KEY, data TEXT NOT NULL)`],
  },
]
