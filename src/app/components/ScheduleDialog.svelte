<script lang="ts">
  import {HOUR, now} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import DateTimeInput from "@lib/components/DateTimeInput.svelte"

  type Props = {
    onPick: (scheduleAt: number) => void
  }

  const {onPick}: Props = $props()

  const back = () => history.back()

  // The button stays disabled until the time is ahead of now, which also blocks enter-to-submit.
  const submit = () => {
    if (value) {
      back()
      onPick(value)
    }
  }

  let value: Maybe<number> = $state(Math.ceil(now() / HOUR + 1) * HOUR)

  const valid = $derived(value && value > now())
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Schedule for later</ModalTitle>
    </ModalHeader>
    <DateTimeInput bind:value disablePast />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!valid}>Schedule</Button>
  </ModalFooter>
</Modal>
