import {execFile} from "node:child_process"
import {promisify} from "node:util"
import type {Maybe} from "@welshman/lib"

const execFileAsync = promisify(execFile)

// execFile does not go through a shell, so a docker that exists only as an alias needs E2E_DOCKER.
export const dockerCommand = process.env.E2E_DOCKER ?? "docker"

export const docker = (...args: string[]) => execFileAsync(dockerCommand, args)

// A compose file names its variables without defaults, so a call that left one out fails to interpolate.
export const makeCompose =
  (file: string, env: Record<string, string>) =>
  (...args: string[]) =>
    execFileAsync(dockerCommand, ["compose", "-f", file, ...args], {env: {...process.env, ...env}})

export type Compose = ReturnType<typeof makeCompose>

// The last lines of what a failed command printed, which is where it says why.
export const describeFailure = (error: unknown) => {
  const {stderr} = Object(error) as {stderr?: string}

  return (stderr?.trim() || String(error)).split("\n").slice(-3).join("\n")
}

export const hasImage = (image: string) =>
  docker("image", "inspect", image).then(
    () => true,
    () => false,
  )

// A pull of a pinned reference can only produce the relay this suite was written against. A backend
// published for one architecture only says which, so a host of another one runs it under emulation.
export const pullImage = async (image: string, override: string, platform?: string) => {
  console.warn(`\nFetching the relay image this suite runs against:\n  ${image}\n`)

  try {
    await docker("pull", ...(platform ? ["--platform", platform] : []), image)
  } catch (error) {
    throw new Error(
      `Could not fetch ${image}: ${describeFailure(error)}\n\n` +
        `Fetch it by hand with \`${dockerCommand} pull ${image}\`, or point ${override} at an ` +
        "image you built yourself.",
      {cause: error},
    )
  }
}

// Compose reports only that a container exited, so without this a startup failure has no reason.
export const composeLogs = (compose: Compose) =>
  compose("logs", "--no-color", "--tail", "50").then(
    ({stdout, stderr}) => [stdout, stderr].filter(Boolean).join("\n").trim(),
    () => "",
  )

// Why the container cannot be driven, or undefined when it can.
const probeDocker = async () => {
  try {
    await docker("compose", "version")

    return undefined
  } catch (error) {
    const {code, stderr} = Object(error) as {code?: string; stderr?: string}

    if (code === "ENOENT") {
      return (
        `\`${dockerCommand}\` is not on PATH for the test runner. If it works in your shell it is ` +
        "an alias or a function rather than an executable, which execFile cannot see: set " +
        "E2E_DOCKER to the real command, e.g. `E2E_DOCKER=podman pnpm test`."
      )
    }

    return (
      `\`${dockerCommand} compose version\` failed, so the daemon is likely not running. ` +
      (stderr?.trim() || String(error))
    )
  }
}

let problem: Maybe<Promise<Maybe<string>>>

// Also written to the terminal, since a skip reason otherwise reaches only the html report.
export const describeDockerProblem = () =>
  (problem ??= probeDocker().then(reason => {
    if (reason) {
      console.warn(
        `\nThe e2e suite cannot drive a container, so every test will skip:\n  ${reason}\n`,
      )
    }

    return reason
  }))
