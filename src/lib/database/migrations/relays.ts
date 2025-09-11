export const RelaysMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS relays (url TEXT PRIMARY, data TEXT NOT NULL);`],
  },
]
