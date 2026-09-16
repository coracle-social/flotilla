<script lang="ts">
  import {onDestroy} from "svelte"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Soundwave from "@assets/icons/soundwave.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
  import {getSetting} from "@app/settings"
  import {popModal, pushModal} from "@app/modal"

  type Props = {
    onTranscribe: () => void
    onVoiceNote: () => void
    onDiscard: () => void
  }

  const {onTranscribe, onVoiceNote, onDiscard}: Props = $props()

  const transcribe = () => {
    if (getSetting("openrouter_key")) {
      pending = false
      popModal()
      onTranscribe()
    } else {
      // Nested, so that the recording is still here to transcribe once a key has been saved.
      pushModal(
        OpenRouterEnable,
        {
          feature: "Voice input",
          subtitle: "Dictate your messages instead of typing them.",
        },
        {nested: true},
      )
    }
  }

  const sendVoiceNote = () => {
    pending = false
    popModal()
    onVoiceNote()
  }

  let pending = true

  // Leaving without choosing throws the recording away, whether that was the discard button, the
  // escape key or a navigation out of the conversation.
  onDestroy(() => {
    if (pending) {
      onDiscard()
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Transcribe or send?</ModalTitle>
      <ModalSubtitle>Your recording can become text, or go as it is.</ModalSubtitle>
    </ModalHeader>
    <Button onclick={transcribe}>
      <CardButton primary>
        {#snippet icon()}
          <div><Icon icon={DocumentText} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Transcribe it</div>
        {/snippet}
        {#snippet info()}
          <div>Turn what you said into text you can edit before sending.</div>
        {/snippet}
      </CardButton>
    </Button>
    <Button onclick={sendVoiceNote}>
      <CardButton>
        {#snippet icon()}
          <div><Icon icon={Soundwave} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Send a voice note</div>
        {/snippet}
        {#snippet info()}
          <div>Attach the recording itself to your message.</div>
        {/snippet}
      </CardButton>
    </Button>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={popModal}>
      <Icon icon={TrashBin} />
      Discard
    </Button>
  </ModalFooter>
</Modal>
