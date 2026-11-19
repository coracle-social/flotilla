#!/usr/bin/env node

// Checks that imports follow the dependency graph in AGENTS.md, and exits 1 when one doesn't.
import fs from "fs"
import path from "path"
import ts from "typescript"
import {ROOT, getScript, resolveImport} from "./imports.mjs"

// Highest first; a module may import its own layer and the layers below it.
const LAYERS = [
  ["routes", "src/routes/"],
  ["components", "src/app/components/"],
  ["shell", "src/app/shell/"],
  ["areas", "src/app/areas/"],
  ["tools", "src/app/tools/"],
  ["navigation", "src/app/navigation/"],
  ["core", "src/app/core/"],
  ["lib", "src/lib/"],
]

// registerAll calls every layer's registerX, so it imports from all of them.
const COMPOSITION_ROOTS = new Set(["src/app/index.ts"])

const walk = dir =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return walk(file)
    }

    return /\.(ts|js|svelte)$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [file] : []
  })

const getLayer = file => LAYERS.findIndex(([, prefix]) => file.startsWith(prefix))

// An area is a directory under areas/, or a single file there such as areas/bookmarks.ts.
const getArea = file =>
  file.startsWith("src/app/areas/") ? file.split("/")[3].replace(/\.ts$/, "") : undefined

const checkImport = (from, to) => {
  const fromLayer = getLayer(from)
  const toLayer = getLayer(to)

  if (fromLayer === -1 || toLayer === -1) {
    return
  }

  const [fromName] = LAYERS[fromLayer]
  const [toName] = LAYERS[toLayer]

  if (toLayer < fromLayer) {
    return `${fromName} imports ${toName}`
  }

  if (getArea(from) && getArea(to) && getArea(from) !== getArea(to)) {
    return "an area imports another area"
  }

  if (toName === "components" && fromName !== "components" && fromName !== "routes") {
    return `${fromName} imports a component`
  }
}

const violations = []

for (const file of walk(path.join(ROOT, "src"))) {
  const from = path.relative(ROOT, file)

  if (!COMPOSITION_ROOTS.has(from)) {
    const {importedFiles} = ts.preProcessFile(getScript(file), true, true)

    for (const {fileName} of importedFiles) {
      const target = resolveImport(file, fileName)
      const reason = target && checkImport(from, path.relative(ROOT, target))

      if (reason) {
        violations.push(`${from} -> ${path.relative(ROOT, target)} (${reason})`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`${violations.length} imports break the layering described in AGENTS.md:\n`)
  console.error(violations.join("\n"))
  process.exit(1)
}

console.log("Layering: no violations")
