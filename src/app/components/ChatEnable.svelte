<script lang="ts">
  import {goto} from "$app/navigation"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {PLATFORM_NAME} from "@app/core/state"
  import {enableGiftWraps} from "@app/core/commands"
  import {clearModals} from "@app/util/modal"

  const {next} = $props()

  const nextUrl = $state.snapshot(next)

  let loading = $state(false)

  const enableChat = async () => {
    enableGiftWraps()
    clearModals()
    goto(nextUrl)
  }

  const submit = async () => {
    loading = true

    try {
      await enableChat()
    } finally {
      loading = false
    }
  }

  const back = () => history.back()
</script>

<form class="column gap-4" onsubmit={preventDefault(submit)}>
  <ModalHeader>
    {#snippet title()}
      <div>Enable Messages</div>
    {/snippet}
    {#snippet info()}
      <div>Do you want to enable direct messages?</div>
    {/snippet}
  </ModalHeader>
  <p>
    By default, direct messages are disabled, since loading them requires
    {PLATFORM_NAME} to download and decrypt a lot of data.
  </p>
  <p>
    If you'd like to enable them, please make sure your signer is set up to to auto-approve requests
    to decrypt data.
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Enable Messages</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
