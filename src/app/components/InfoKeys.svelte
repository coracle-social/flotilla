<script lang="ts">
  import Link from "@lib/components/Link.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import KeyRecoveryRequest from "@app/components/KeyRecoveryRequest.svelte"
  import {isPomadeSession} from "@app/core/pomade"
  import {PLATFORM_NAME} from "@app/core/env"
  import {pushModal} from "@app/ui/modal"
  import {session} from "@app/core/session"

  const back = () => history.back()

  const startRecoveryRequest = () => pushModal(KeyRecoveryRequest)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>What is a private key?</ModalTitle>
    </ModalHeader>
    <p>
      Most online services keep track of users by giving them a username and password. This gives
      the service <strong>total control</strong> over their users, allowing them to ban them at any time,
      or sell their activity.
    </p>
    <p>
      On <Link external href="https://nostr.com/">Nostr</Link>, <strong>you</strong> control your
      own identity and social data, through the magic of cryptography. The basic idea is that you
      have a
      <strong>public key</strong>, which acts as your user ID, and a
      <strong>private key</strong> which allows you to prove your identity.
    </p>
    {#if isPomadeSession($session)}
      <p>
        It's very important to keep private keys safe, but this can sometimes be tricky, which is
        why {PLATFORM_NAME}
        supports a traditional account-based login for new users.
      </p>
      <p>If you'd like to switch to self-custody, please click below to get started.</p>
    {:else}
      <Button class="button button-primary" onclick={back}>Got it</Button>
    {/if}
  </ModalBody>
  {#if isPomadeSession($session)}
    <ModalFooter>
      <Button class="button button-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button class="button button-primary" onclick={startRecoveryRequest}>
        <Icon icon={CheckCircle} />
        I want to hold my own keys
      </Button>
    </ModalFooter>
  {/if}
</Modal>
