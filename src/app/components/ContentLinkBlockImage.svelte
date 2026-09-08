<script lang="ts">
  import {onMount, onDestroy} from "svelte"
  import {displayUrl, once} from "@welshman/lib"
  import {getBlob, decryptFile, makeBlossomAuthEvent, tagSpec, tagValue} from "@welshman/util"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {user} from "@app/core"
  import {getUrlTags} from "@app/content"

  const {value, event, ...props} = $props()

  const url = value.url.toString()
  const meta = getUrlTags(url, event)

  // Fallback to filename if hash was omitted from the message for interoperability
  const hash = tagValue(tagSpec("x"), meta) || url.split(/[\/\.]/).slice(-2)[0]
  const key = tagValue(tagSpec("decryption-key"), meta)
  const nonce = tagValue(tagSpec("decryption-nonce"), meta)
  const algorithm = tagValue(tagSpec("encryption-algorithm"), meta)
  const mime = tagValue(tagSpec("m"), meta)
  const fileName =
    tagValue(tagSpec("filename"), meta) ||
    tagValue(tagSpec("name"), meta) ||
    decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "image")

  const revokeSrc = () => {
    if (src.startsWith("blob:")) {
      URL.revokeObjectURL(src)
    }
  }

  const setBlobSrc = (data: Blob | Uint8Array<ArrayBuffer>, type?: string) => {
    revokeSrc()
    src = URL.createObjectURL(new File([data], fileName, type ? {type} : undefined))
  }

  const onError = once(async () => {
    // If the image failed to load, try authenticating
    if (hash) {
      const server = new URL(url).origin
      const template = makeBlossomAuthEvent({action: "get", server, hashes: [hash]})
      const authEvent = await $user.signer.sign(template)
      const res = await getBlob(server, hash, {authEvent})

      if (res.status === 200) {
        const blob = await res.blob()
        setBlobSrc(blob, blob.type || undefined)
      } else {
        hasError = true
      }
    } else {
      hasError = true
    }
  })

  let hasError = $state(false)
  let src = $state("")

  onMount(async () => {
    // If we have an encryption algorithm, fetch and decrypt
    if (algorithm === "aes-gcm" && key && nonce) {
      const response = await fetch(url)

      if (response.ok) {
        const ciphertext = new Uint8Array(await response.arrayBuffer())
        const decryptedData = await decryptFile({ciphertext, key, nonce, algorithm})

        setBlobSrc(new Uint8Array(decryptedData), mime)
      }
    } else {
      src = url
    }
  })

  onDestroy(() => {
    revokeSrc()
  })
</script>

{#if hasError}
  <a href={url} class="link-content whitespace-nowrap">
    <Icon icon={LinkRound} size={3} class="inline-block" />
    {displayUrl(url)}
  </a>
{:else if src}
  <img alt="" {src} onerror={onError} {...props} />
{/if}
