#!/usr/bin/env node

// Checks that the root layout reaches no deferred module through static imports, and exits 1 when it does.
import path from "path"
import ts from "typescript"
import {ROOT, getScript, resolveImport} from "./imports.mjs"

// Each is imported dynamically where it's used, which keeps it out of the startup bundle.
const DEFERRED = new Set([
  "livekit-client",
  "leaflet",
  "qrcode",
  "compressorjs-next",
  "src/lib/icons.ts",
])

const ENTRY = path.join(ROOT, "src/routes/+layout.svelte")

// With verbatimModuleSyntax the build erases only `import type` and `export type` statements.
const isValueImport = statement =>
  !statement.isTypeOnly && statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword

const getValueImports = file => {
  const source = ts.createSourceFile(
    file,
    getScript(file),
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  )

  return source.statements
    .filter(statement => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    .filter(statement => statement.moduleSpecifier && isValueImport(statement))
    .map(statement => statement.moduleSpecifier.text)
}

// Each file reached maps to the file that first imported it, which gives the chain back to the entry.
const importers = new Map([[ENTRY, undefined]])
const queue = [ENTRY]
const leaks = []

while (queue.length > 0) {
  const file = queue.shift()

  for (const specifier of getValueImports(file)) {
    const target = resolveImport(file, specifier)
    const name = target ? path.relative(ROOT, target) : specifier

    if (DEFERRED.has(name)) {
      leaks.push({file, name})
    }

    if (target && /\.(ts|js|svelte)$/.test(target) && !importers.has(target)) {
      importers.set(target, file)
      queue.push(target)
    }
  }
}

const getChain = file => {
  const chain = []

  for (let current = file; current; current = importers.get(current)) {
    chain.unshift(path.relative(ROOT, current))
  }

  return chain
}

if (leaks.length > 0) {
  console.error("The root layout imports these deferred modules statically:\n")

  for (const {file, name} of leaks) {
    console.error([...getChain(file), name].join("\n  -> ") + "\n")
  }

  process.exit(1)
}

console.log("Startup: no deferred modules")
