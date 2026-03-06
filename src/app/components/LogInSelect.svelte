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
  import {deleteDeactivatedPomadeSessions, loginWithPomade} from "@app/util/pomade"
  import {setChecked} from "@app/util/notifications"
  import {clearModals} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  interface Props {
    email: string
    options: AccountOption[]
    clientSecret: string
  }

  const {email, options, clientSecret}: Props = $props()

  let loading = $state(false)

  const back = () => history.back()

  const selectAccount = async ({client, peers}: AccountOption) => {
    loading = true

    try {
      const {clientOptions, ...res} = await Client.selectLogin(clientSecret, client, peers)

      if (res.ok && clientOptions) {
        loginWithPomade(clientOptions, email)
        deleteDeactivatedPomadeSessions()
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
          onclick={() => selectAccount(option)}
          disabled={loading}
          class="card2 bg-alt flex w-full items-center p-3 text-left">
          <Profile pubkey={option.pubkey} />
        </Button>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Spinner {loading} />
  </ModalFooter>
</Modal>
