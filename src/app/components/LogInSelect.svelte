<script lang="ts">
  import type {AccountOption} from "@pomade/core"
  import {uniqBy} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import {selectPomadeLogin} from "@app/core/pomade"
  import {getPomadeLoginFailureMessage, POMADE_NETWORK_ERROR_MESSAGE} from "@app/core/pomade"
  import {clearModals} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    email: string
    options: AccountOption[]
    clientSecret: string
  }

  const {email, options, clientSecret}: Props = $props()

  const back = () => history.back()

  const {loading, submit: select} = trackSubmit(
    () => POMADE_NETWORK_ERROR_MESSAGE,
    async (option: AccountOption) => {
      const res = await selectPomadeLogin(clientSecret, option, email)

      if (res.ok) {
        clearModals()
      } else {
        console.error(res.messages)

        pushToast({
          theme: "error",
          message: getPomadeLoginFailureMessage(res.messages),
        })
      }
    },
  )

  const selectAccount = (option: AccountOption) => () => select(option)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Select Account</ModalTitle>
      <ModalSubtitle
        >Multiple accounts are associated with {email}. Please select one to continue.</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#each uniqBy(o => o.pubkey, options) as option (option.pubkey)}
        <Button
          onclick={selectAccount(option)}
          disabled={$loading}
          class="card flex w-full items-center p-3 text-left">
          <Profile inert pubkey={option.pubkey} />
        </Button>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={$loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Spinner loading={$loading} />
  </ModalFooter>
</Modal>
