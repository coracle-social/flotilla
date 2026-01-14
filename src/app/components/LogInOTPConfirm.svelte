<script lang="ts">
  import {Client} from "@pomade/core"
  import {loginWithPomade} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {clearModals} from "@app/util/modal"
  import {setChecked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"
  import {POMADE_SIGNERS} from "@app/core/state"

  type Props = {
    email: string
    peersByPrefix: Map<string, string>
  }

  const {email, peersByPrefix}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    const otps = input
      .split(/\n/)
      .map(x => x.trim())
      .filter(x => x.match(/^[0-9]{8}$/))

    if (otps.length < 2) {
      return pushToast({
        theme: "error",
        message: "Failed to recover, not enough valid recovery codes were provided.",
      })
    }

    loading = true

    try {
      const {ok, options, messages, clientSecret} = await Client.loginWithChallenge(
        email,
        peersByPrefix,
        otps,
      )

      if (!ok) {
        console.error(messages)

        return pushToast({
          theme: "error",
          message: "Sorry, we were unable to log you in.",
        })
      }

      const [client, peers] = options[0]!
      const {clientOptions, ...res} = await Client.selectLogin(clientSecret, client, peers)

      if (res.ok && clientOptions) {
        loginWithPomade(clientOptions.group.group_pk.slice(2), email, clientOptions)
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
    } finally {
      loading = false
    }
  }

  let input = $state("")
  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(onSubmit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Log In</div>
    {/snippet}
    {#snippet info()}
      <div>Enter the login codes sent to your email</div>
    {/snippet}
  </ModalHeader>
  <p>Your login codes have been sent!</p>
  <p>
    For security reasons, you may receive three or more emails with login codes in them. Please
    paste <strong>all</strong> login codes into the text box below, on separate lines.
  </p>
  <textarea
    rows={POMADE_SIGNERS.length + 1}
    class="textarea textarea-bordered leading-4"
    bind:value={input}></textarea>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Log In</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
