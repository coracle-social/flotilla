<script lang="ts">
  import type {AccountOption} from "@pomade/core"
  import {Client} from "@pomade/core"
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
  import {deleteDeactivatedPomadeSessions, loginWithPomade} from "@app/pomade"
  import {getPomadeLoginFailureMessage, POMADE_NETWORK_ERROR_MESSAGE} from "@app/pomade"
  import {setChecked} from "@app/notifications"
  import {clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    email: string
    options: AccountOption[]
    clientSecret: string
  }

  const {email, options, clientSecret}: Props = $props()

  let loading = $state(false)

  const back = () => history.back()

  const selectAccount =
    ({client, peers}: AccountOption) =>
    async () => {
      loading = true

      try {
        const {clientOptions, ...res} = await Client.selectLogin(clientSecret, client, peers)

        if (res.ok && clientOptions) {
          await loginWithPomade(clientOptions, email)
          deleteDeactivatedPomadeSessions()
          setChecked("*")
          clearModals()
        } else {
          console.error(res.messages)

          pushToast({
            theme: "error",
            message: getPomadeLoginFailureMessage(res.messages),
          })
        }
      } catch (error) {
        console.error("Login error:", error)

        pushToast({
          theme: "error",
          message: POMADE_NETWORK_ERROR_MESSAGE,
        })
      } finally {
        loading = false
      }
    }
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
          disabled={loading}
          class="card flex w-full items-center p-3 text-left">
          <Profile inert pubkey={option.pubkey} />
        </Button>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Spinner {loading} />
  </ModalFooter>
</Modal>
