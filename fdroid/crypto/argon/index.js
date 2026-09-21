import {argon2idAsync} from "@noble/hashes/argon2.js"

// Pomade's main module and worker both use this binary-output API.
export const argon2id = ({
  password,
  salt,
  iterations,
  memorySize,
  parallelism,
  hashLength,
  outputType,
}) => {
  if (outputType !== "binary") {
    throw new Error("Expected Pomade's binary Argon2id output")
  }
  return argon2idAsync(password, salt, {
    t: iterations,
    m: memorySize,
    p: parallelism,
    dkLen: hashLength,
  })
}
