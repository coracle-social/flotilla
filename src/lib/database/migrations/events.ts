export const EventsMigrationStatements = [
  {
    toVersion: 1,
    statements: [`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL);`],
  },
]
