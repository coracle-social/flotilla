import type {Maybe} from "@welshman/lib"
import {first, normalizeUrl, parseJson, sha256, simpleCache} from "@welshman/lib"
import {canUploadBlob, encryptFile, makeBlossomAuthEvent, uploadBlob} from "@welshman/util"
import {Nip01Signer} from "@welshman/signer"
import type {UploadTask} from "@welshman/editor"
import {compressFile} from "@lib/html"
import {app, blossomServerLists, relays} from "@app/core"
import {DEFAULT_BLOSSOM_SERVERS} from "@app/env"

export const normalizeBlossomUrl = (url: string) => normalizeUrl(url.replace(/^ws/, "http"))

export const fetchHasBlossomSupport = async (url: string) => {
  if (relays.get().get(url)?.hasNip("BUD-02")) {
    return true
  }

  const server = normalizeBlossomUrl(url)
  const $signer = app.get().user?.signer || Nip01Signer.ephemeral()
  const headers: Record<string, string> = {
    "X-Content-Type": "text/plain",
    "X-Content-Length": "1",
    "X-SHA-256": "73cb3858a687a8494ca3323053016282f3dad39d42cf62ca4e79dda2aac7d9ac",
  }

  try {
    const authEvent = await $signer.sign(makeBlossomAuthEvent({action: "upload", server}))
    const res = await canUploadBlob(server, {authEvent, headers})

    return res.status === 200
  } catch (e) {
    if (!String(e).match(/Failed to fetch|NetworkError/)) {
      console.error(e)
    }
  }

  return false
}

export const hasBlossomSupport = simpleCache(([url]: [string]) => fetchHasBlossomSupport(url))

export type GetBlossomServerOptions = {
  url?: string
}

export const getBlossomServer = async (options: GetBlossomServerOptions = {}) => {
  if (options.url) {
    if (await hasBlossomSupport(options.url)) {
      return normalizeBlossomUrl(options.url)
    }
  }

  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    const userUrl = first(blossomServerLists.get().urls($pubkey).get())

    if (userUrl) {
      return normalizeBlossomUrl(userUrl)
    }
  }

  return first(DEFAULT_BLOSSOM_SERVERS)!
}

// The editor's default list leaves out the formats an iPhone camera actually produces, so
// anything shared from Photos would be rejected without a word. Heic gets re-encoded by the
// compressor on its way to a blossom server; quicktime is uploaded as-is.
export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "video/quicktime",
]

export type CompressFileOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: string
}

// Webp/gif/svg either break the compressor or lose animation, pass them through untouched
export const compressFileForUpload = async (file: File, options: CompressFileOptions = {}) =>
  file.type.match("image/(webp|gif|svg)") ? file : compressFile(file, options)

export type UploadFileOptions = {
  url?: string
  encrypt?: boolean
}

export type UploadFileResult = {
  error?: string
  result?: UploadTask
}

export const uploadFile = async (file: File, options: UploadFileOptions = {}) => {
  try {
    const {name, type} = file

    const tags: string[][] = []

    if (options.encrypt) {
      const {ciphertext, key, nonce, algorithm} = await encryptFile(file)

      tags.push(
        ["decryption-key", key],
        ["decryption-nonce", nonce],
        ["encryption-algorithm", algorithm],
      )

      file = new File([new Uint8Array(ciphertext)], name, {
        type: "application/octet-stream",
      })
    }

    const ext = "." + type.split("/")[1]
    const server = await getBlossomServer(options)
    const hashes = [await sha256(await file.arrayBuffer())]
    const $signer = app.get().user?.signer || Nip01Signer.ephemeral()
    const authTemplate = makeBlossomAuthEvent({action: "upload", server, hashes})
    const authEvent = await $signer.sign(authTemplate)
    const res = await uploadBlob(server, file, {authEvent})
    const text = await res.text()

    let task
    try {
      task = parseJson(text)
    } catch (e) {
      return {error: text}
    }

    if (!task?.uploaded) {
      return {error: text || `Failed to upload file (HTTP ${res.status})`}
    }

    // Always append correct file extension if we encrypted the file, or if it's missing
    let url = task.url
    if (options.encrypt) {
      url = url.replace(/\.\w+$/, "") + ext
    } else if (new URL(url).pathname.split(".").length === 1) {
      url += ext
    }

    const result = {...task, tags, url}

    return {result}
  } catch (e: any) {
    console.error("Error caught when uploading file:", e)

    return {error: e.toString()}
  }
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener("load", () => resolve(reader.result as string))
    reader.addEventListener("error", () => reject(reader.error))
    reader.readAsDataURL(file)
  })

export const uploadFileOrFallback = async (
  file: File,
  options: UploadFileOptions = {},
): Promise<{url: string; tags: string[][]}> => {
  const {result} = await uploadFile(file, options)

  if (result?.url) {
    return result
  }

  return {url: await readFileAsDataUrl(file), tags: []}
}

export const resolveImageInput = async (
  file: Maybe<File>,
  url: Maybe<string>,
  options: CompressFileOptions = {},
) => {
  if (!file) {
    return url
  }

  const compressedFile = await compressFileForUpload(file, options)
  const result = await uploadFileOrFallback(compressedFile)

  return result.url
}
