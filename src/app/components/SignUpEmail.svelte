<script lang="ts">
  import {Client} from "pomade"
  import {choice} from "@welshman/lib"
  import {makeSecret} from "@welshman/util"
  import type {Profile} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SignUpEmailConfirm from "@app/components/SignUpEmailConfirm.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {PLATFORM_NAME, POMADE_MAILERS} from "@app/core/state"

  type Props = {
    profile: Profile
  }

  const {profile}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const {clientOptions} = await Client.register(2, 3, makeSecret())
      const client = new Client(clientOptions)

      let res
      try {
        res = await client.setRecoveryMethod(email, choice(POMADE_MAILERS))
      } finally {
        client.stop()
      }

      if (res.ok) {
        pushModal(SignUpEmailConfirm, {email, profile, clientOptions})
      } else {
        const message = res.messages[0]?.payload.message || "Please try again."

        pushToast({
          theme: "error",
          message: `Failed to register! ${message}.`,
        })
      }
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: "Failed to register! Please try again.",
      })
    } finally {
      loading = false
    }
  }

  let email = $state("")
  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Verify your Email Address</div>
    {/snippet}
    {#snippet info()}
      <div>Keep your keys safe using multi-signer key sharing</div>
    {/snippet}
  </ModalHeader>
  <p>
    Under the hood, nostr uses "cryptographic keypairs" to help you prove that your identity is
    actually you.
  </p>
  <p>
    If you you're not ready to take control of your keys though, that's ok! We'll keep them safe
    until you are.
  </p>
  <FieldInline>
    {#snippet label()}
      <p>Email*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Letter} />
        <input bind:value={email} />
      </label>
    {/snippet}
  </FieldInline>
  <p class="text-sm">
    Your email only works to log in to {PLATFORM_NAME}. To use your nostr key elsewhere, visit your
    settings page.
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" type="submit" disabled={loading || !email}>
      <Spinner {loading}>Continue</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
