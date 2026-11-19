// Reads the imports of a source file and resolves them to files in the repository.
import fs from "fs"
import path from "path"

export const ROOT = path.resolve(import.meta.dirname, "..")

const ALIASES = {
  "@src/": "src/",
  "@app/": "src/app/",
  "@lib/": "src/lib/",
  "@assets/": "src/assets/",
}

export const getScript = file => {
  const text = fs.readFileSync(file, "utf8")

  if (file.endsWith(".svelte")) {
    return [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map(match => match[1])
      .join("\n")
  }

  return text
}

export const resolveImport = (from, specifier) => {
  const [bare] = specifier.split("?")
  const alias = Object.keys(ALIASES).find(prefix => bare.startsWith(prefix))

  let base
  if (alias) {
    base = path.join(ROOT, ALIASES[alias], bare.slice(alias.length))
  } else if (bare.startsWith(".")) {
    base = path.resolve(path.dirname(from), bare)
  }

  if (base) {
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.js`,
      `${base}.svelte`,
      path.join(base, "index.ts"),
    ]

    return candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile())
  }
}
