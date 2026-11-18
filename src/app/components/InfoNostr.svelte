<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import Link from "@app/components/Link.svelte"

  const back = () => history.back()
</script>

<Modal
  ><ModalBody>
    <ModalHeader>
      <ModalTitle>What is nostr?</ModalTitle>
    </ModalHeader>
    <p>
      <Link external href="https://nostr.com/" class="link">Nostr</Link> is way to build social apps that
      talk to each other. Users own their social identity instead of renting it from a tech company, and
      can take it with them.
    </p>
    <p>
      If you'd like to learn more about what other apps exist in the nostr ecosystem, please visit <Link
        external
        class="link"
        href="https://nostrapps.com/">nostrapps.com</Link
      >.
    </p>
    <p>
      To learn more about how to manage your keys, or to set up an account, try
      <Link external class="link" href="https://nosta.me/">nosta.me</Link>.
    </p>
    <Button class="button button-primary" onclick={back}>Got it</Button>
  </ModalBody></Modal>
