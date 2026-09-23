<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import {Zappers} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import {app} from "@app/core"

  type Props = {
    url?: string
    pubkey: string
  }

  const {url, pubkey}: Props = $props()

  const zapper = $app.use(Zappers).forPubkey(pubkey, removeUndefined([url])).$

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Unable to Zap</ModalTitle>
    </ModalHeader>
    <p>
      Zapping <ProfileLink {pubkey} class="text-primary" /> isn't possible right now because
      {#if $zapper}
        their zap receiver isn't correctly set up.
      {:else}
        they don't currently have a zap receiver set up.
      {/if}
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
