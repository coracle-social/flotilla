export const RelaysMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS relays (url TEXT PRIMARY KEY, data TEXT NOT NULL)`],
  },
]
