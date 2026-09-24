import {execFileSync, spawn} from "node:child_process"
import {createInterface} from "node:readline/promises"

const color = code => text => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text)

export const bold = color(1)
export const dim = color(2)
export const red = color(31)
export const green = color(32)
export const yellow = color(33)

export const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: "inherit", ...options})

    child.on("error", reject)
    child.on("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${signal || code})`)),
    )
  })

export const output = (command, args, options = {}) =>
  execFileSync(command, args, {encoding: "utf-8", ...options}).trim()

export const installed = command => {
  try {
    return Boolean(output("which", [command]))
  } catch {
    return false
  }
}

export const ask = async question => {
  const readline = createInterface({input: process.stdin, output: process.stdout})

  try {
    return await readline.question(question)
  } finally {
    readline.close()
  }
}

export const fail = message => {
  console.error(red(message))
  process.exit(1)
}
