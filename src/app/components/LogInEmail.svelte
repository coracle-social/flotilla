<script lang="ts">
  import {Client} from "pomade"
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
  import LogInEmailConfirm from "@app/components/LogInEmailConfirm.svelte"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {PLATFORM_NAME} from "@app/core/state"

  interface Props {
    email?: string
  }

  let {email = $bindable("")}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const {ok, messages, clientSecret} = await Client.startLogin(email)

      if (ok) {
        pushModal(LogInEmailConfirm, {email, clientSecret})
      } else {
        console.error(messages)

        pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
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
      <div>Log in using your email and a one-time login code</div>
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
  <p class="text-sm">
    Your email only works to log in to {PLATFORM_NAME}. To use your nostr key elsewhere, visit your
    settings page.
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || !email}>
      <Spinner {loading}>Request Login Code</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
