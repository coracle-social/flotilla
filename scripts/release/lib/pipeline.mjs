import {existsSync, readFileSync} from "node:fs"
import {join, relative} from "node:path"
import {parseArgs} from "node:util"
import {
  fastlaneChangelog,
  followUps,
  git,
  name,
  notes,
  repository,
  root,
  shortNotes,
  version,
} from "./context.mjs"
import {ask, bold, dim, fail, green, red, yellow} from "./shell.mjs"

export const release = async (command, steps) => {
  let args

  try {
    args = parseArgs({
      options: {
        check: {type: "boolean", default: false},
        yes: {type: "boolean", short: "y", default: false},
      },
      allowPositionals: true,
    })
  } catch (error) {
    fail(`${error.message}\nUsage: ${command} [--check] [--yes] [step...]`)
  }

  const {values: options, positionals: chosen} = args
  const unknownStep = chosen.find(step => !steps.some(({name}) => name === step))

  if (unknownStep) {
    fail(`Unknown step ${unknownStep}. Steps: ${steps.map(step => step.name).join(", ")}`)
  }

  const selected = chosen.length > 0 ? steps.filter(step => chosen.includes(step.name)) : steps
  const width = Math.max(...selected.map(step => step.name.length))
  const problems = selected.map(step => ({step, missing: step.missing?.() ?? []}))
  const warnings = []

  // pnpm keeps a copy of the lockfile it last installed from, so any difference means a pull or
  // checkout since then changed dependencies the build would silently go without
  const installed = join(root, "node_modules/.pnpm/lock.yaml")

  if (
    !existsSync(installed) ||
    readFileSync(installed, "utf-8") !== readFileSync(join(root, "pnpm-lock.yaml"), "utf-8")
  ) {
    problems.push({
      missing: ["node_modules doesn't match pnpm-lock.yaml: pnpm install --frozen-lockfile"],
    })
  }

  if (!notes) {
    problems.push({missing: [`CHANGELOG.md has no "# ${version}" section`]})
  } else if (
    !existsSync(fastlaneChangelog) ||
    readFileSync(fastlaneChangelog, "utf-8") !== `${shortNotes}\n`
  ) {
    // F-Droid reads it from the tag, so it has to be committed before tagging
    problems.push({
      missing: [
        `${relative(root, fastlaneChangelog)} doesn't match CHANGELOG.md: pnpm release:changelog`,
      ],
    })
  }

  if (git("rev-parse", `refs/tags/${version}`)) {
    const pushed = git("ls-remote", "--tags", "origin", `refs/tags/${version}`)

    if (pushed === undefined) {
      warnings.push("couldn't reach origin to check whether the tag is pushed")
    } else if (!pushed) {
      problems.push({missing: [`the ${version} tag is not on origin: git push origin ${version}`]})
    }

    if (git("rev-parse", "HEAD") !== git("rev-parse", `refs/tags/${version}^{commit}`)) {
      warnings.push(`HEAD is not the ${version} tag, so the build won't match what you tagged`)
    }
  } else {
    problems.push({
      missing: [`there is no ${version} tag: git tag ${version} && git push origin ${version}`],
    })
  }

  if (git("status", "--porcelain")) {
    warnings.push("the working tree has uncommitted changes")
  }

  console.log(bold(`\n${name} ${version} -> ${repository.host}${repository.pathname}\n`))

  for (const step of selected) {
    console.log(`  ${step.name.padEnd(width)}  ${step.title}`)
  }

  if (warnings.length > 0) {
    console.log("")

    for (const warning of warnings) {
      console.log(yellow(`  ! ${warning}`))
    }
  }

  const blocked = problems.filter(({missing}) => missing.length > 0)

  if (blocked.length > 0) {
    console.log("")

    for (const {step, missing} of blocked) {
      console.log(red(`  x ${step ? `${step.name}: missing ${missing.join(", ")}` : missing[0]}`))

      for (const line of step?.setup ?? []) {
        console.log(dim(`      ${line}`))
      }
    }

    fail("\nNothing ran.")
  }

  if (options.check) {
    console.log(green("\nReady to go."))
    process.exit(0)
  }

  if (!options.yes) {
    if (!process.stdin.isTTY) {
      fail("Not a terminal; pass --yes to run unattended")
    }

    const answer = await ask(`\nRelease ${version}? [y/N] `)

    if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
      fail("Aborted.")
    }
  }

  const done = []

  for (const [index, step] of selected.entries()) {
    console.log(bold(`\n> ${step.title}`))

    const started = Date.now()

    try {
      await step.run()
    } catch (error) {
      console.error(red(`\n${step.name} failed: ${error.message}`))

      const remaining = selected.slice(index).map(remainingStep => remainingStep.name)

      fail(`Pick up where this left off with: ${command} ${remaining.join(" ")}`)
    }

    done.push(`${step.name.padEnd(width)}  ${Math.round((Date.now() - started) / 1000)}s`)
  }

  console.log(bold(`\n${name} ${version}\n`))

  for (const line of done) {
    console.log(`  ${green("done")}  ${line}`)
  }

  if (followUps.length > 0) {
    console.log(bold("\nLeft to do by hand"))

    for (const followUp of followUps) {
      console.log(`  - ${followUp}`)
    }
  }
}
