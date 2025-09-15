export const ZappersMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS zappers (lnurl TEXT PRIMARY KEY, data TEXT NOT NULL);`,
    ],
  },
]
