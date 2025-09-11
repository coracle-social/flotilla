export const HandlesMigrationStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS handles (nip05 TEXT PRIMARY KEY, data TEXT NOT NULL);`,
    ],
  },
]
