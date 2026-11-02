<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import {PLATFORM_NAME} from "@app/core/env"

  const back = () => history.back()
</script>

<Modal
  ><ModalBody>
    <ModalHeader>
      <ModalTitle>What is a nostr address?</ModalTitle>
    </ModalHeader>
    <p>
      {PLATFORM_NAME} hosts spaces on the <Link external href="https://nostr.com/" class="underline"
        >Nostr protocol</Link
      >. Nostr uses "nostr addresses" to make it easier for people to find you, without having to
      memorize your public key (your user id).
    </p>
    <p>
      There are several providers of nostr addresses, including several clients. You can find a list
      and more information on <Link
        external
        href="https://nostr.how/en/guides/get-verified"
        class="underline">nostr.how</Link
      >.
    </p>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalBody></Modal>
