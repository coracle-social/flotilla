<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {parse, renderAsHtml} from "@welshman/content"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {preventDefault} from "@lib/html"
  import {ucFirst} from "@lib/util"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import {leaveSpace} from "@app/access"
  import {clearModals, navigate, pushModal} from "@app/modal"

  type Props = {
    url: string
    error: string
  }

  const {url, error}: Props = $props()

  const back = () => navigate("/home")

  const requestAccess = () => pushModal(SpaceAccessRequest, {url, callback: clearModals})

  const leave = async () => {
    loading = true

    try {
      await leaveSpace(url)
      await navigate("/home")
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(requestAccess)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Access Error</ModalTitle>
      <ModalSubtitle>We couldn't connect you to this space.</ModalSubtitle>
    </ModalHeader>
    <p>
      We received an error from the relay indicating you don't have access to {displayRelayUrl(
        url,
      )}:
    </p>
    <p class="card welshman-content">
      {@html renderAsHtml(parse({content: ucFirst(error)}))}
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Home
    </Button>
    <div class="flex gap-2">
      <Button class="button button-error" onclick={leave} disabled={loading}>Leave Space</Button>
      <Button type="submit" class="button button-primary" disabled={loading}>
        Request Access
        <Icon icon={AltArrowRight} />
      </Button>
    </div>
  </ModalFooter>
</Modal>
