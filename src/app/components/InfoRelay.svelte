<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {PLATFORM_NAME} from "@app/core/env"

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>What is a relay?</ModalTitle>
    </ModalHeader>
    <p>
      {PLATFORM_NAME} hosts spaces on the <Link external href="https://nostr.com/" class="underline"
        >Nostr protocol</Link
      >. Nostr uses "relays" to host data, which are special-purpose servers that speak nostr's
      language. This means that anyone can host their own data, making the web more decentralized
      and resilient.
    </p>
    <p>
      Different relays have different policies for access control and content retention. Be sure to
      double check that you have access to the relays you try to use by visiting their website.
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalFooter>
</Modal>
