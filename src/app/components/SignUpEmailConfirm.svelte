<script lang="ts">
  import {Client} from "pomade"
  import type {ClientOptions} from "pomade"
  import type {Profile} from "@welshman/util"
  import {loginWithPomade} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"

  type Props = {
    email: string
    profile: Profile
    clientOptions: ClientOptions
  }

  const {email, clientOptions}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    const client = new Client(clientOptions)

    try {
      const res = await client.finalizeRecoveryMethod(challenge)

      if (res.ok) {
        loginWithPomade(client.group.group_pk.slice(2), clientOptions)
        pushToast({message: "Successfully logged in!"})
        setChecked("*")
        clearModals()
      } else {
        console.error(res.messages)

        pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
        })
      }
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: "Sorry, that looks like an invalid login code.",
      })
    } finally {
      loading = false
      client.stop()
    }
  }

  let challenge = $state("")
  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Verify your Email Address</div>
    {/snippet}
    {#snippet info()}
      <div>Enter the one-time login code sent to your email</div>
    {/snippet}
  </ModalHeader>
  <FieldInline>
    {#snippet label()}
      <p>Login Code*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={Key} />
        <input bind:value={challenge} />
      </label>
    {/snippet}
  </FieldInline>
  <p class="text-sm">
    We just sent a one-time login code to {email}. Once you receive it, you can enter it above.
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || !challenge}>
      <Spinner {loading}>Log In</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
