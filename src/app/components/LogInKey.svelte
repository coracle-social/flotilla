<script lang="ts">
  import {bytesToHex} from "@welshman/lib"
  import {loginWithNip01} from "@welshman/app"
  import {decrypt} from "nostr-tools/nip49"
  import {preventDefault} from "@lib/html"
  import {nsecDecode} from "@lib/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Key from "@assets/icons/key.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"

  let loading = $state(false)
  let keyInput = $state("")
  let password = $state("")

  const back = () => history.back()

  const isHex = $derived(keyInput.match(/^[0-9a-f]{64}$/i))

  const isNsec = $derived(keyInput.startsWith("nsec1"))

  const isNcryptsec = $derived(keyInput.startsWith("ncryptsec1"))

  const canSubmit = $derived(!loading && (isHex || isNsec || isNcryptsec))

  const onSubmit = async () => {
    loading = true

    try {
      let secret: string

      if (isNcryptsec) {
        secret = bytesToHex(decrypt(keyInput, password))
      } else if (isNsec) {
        secret = nsecDecode(keyInput)
      } else if (isHex) {
        secret = keyInput.toLowerCase()
      } else {
        return pushToast({
          theme: "error",
          message: "Invalid key format. Please enter a hex key, nsec, or ncryptsec.",
        })
      }

      loginWithNip01(secret)
      pushToast({message: "Successfully logged in!"})
      setChecked("*")
      clearModals()
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: isNcryptsec
          ? "Failed to decrypt key. Please check your password."
          : "Invalid key format. Please check your input.",
      })
    } finally {
      loading = false
    }
  }
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In with Key</div>
    {/snippet}
    {#snippet info()}
      <div>Enter your nostr private key to log in.</div>
    {/snippet}
  </ModalHeader>
  <FieldInline>
    {#snippet label()}
      <p>Your Key*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input type="password" bind:value={keyInput} placeholder="nsec1..." />
      </label>
    {/snippet}
  </FieldInline>
  {#if isNcryptsec}
    <FieldInline>
      {#snippet label()}
        <p>Password*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Key} />
          <input type="password" bind:value={password} placeholder="Your password" />
        </label>
      {/snippet}
    </FieldInline>
  {/if}
  <div class="card2 card2-sm bg-alt flex flex-col gap-2 text-sm">
    <strong class="flex items-center gap-2">
      <Icon icon={Danger} />
      Please note!
    </strong>
    <p>
      Logging in this way is not a best practice. For better security, please consider using a
      <Link external href="https://nostrapps.com#signers" class="link">signer app</Link>
      to keep your keys safe.
    </p>
  </div>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!canSubmit}>
      <Spinner {loading}>Log in</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
