<script lang="ts">
  import {Client} from "@pomade/core"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import LogInOTPConfirm from "@app/components/LogInOTPConfirm.svelte"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  interface Props {
    email?: string
  }

  let {email = $bindable("")}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const {ok, peersByPrefix} = await Client.requestChallenge(email)

      if (ok) {
        pushModal(LogInOTPConfirm, {email, peersByPrefix})
      } else {
        pushToast({
          theme: "error",
          message: "Sorry, we were unable to request a login code.",
        })
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In</div>
    {/snippet}
    {#snippet info()}
      <div>Log in using a one-time login code</div>
    {/snippet}
  </ModalHeader>
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
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || !email}>
      <Spinner {loading}>Log in</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
