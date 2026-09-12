<script lang="ts">
  import {onMount} from "svelte"
  import {Share} from "@capacitor/share"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Upload from "@assets/icons/upload.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import {pubkeyLink} from "@app/env"
  import {clip} from "@app/toast"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const code = pubkeyLink(pubkey)

  const back = () => history.back()

  const copyCode = () => clip(code)

  const shareProfile = async () => {
    if (!canShare) return

    try {
      await Share.share({url: code})
    } catch (e) {
      console.error(e)
    }
  }

  let canShare = $state(false)

  onMount(async () => {
    try {
      const {value} = await Share.canShare()
      canShare = value
    } catch {
      canShare = false
    }
  })
</script>

<Modal label="Share profile">
  <ModalBody>
    <div class="flex flex-col items-center gap-4 text-center">
      <strong>Share Profile</strong>
      <div class="w-48">
        <QRCode {code} />
      </div>
      <div class="flex w-full gap-2">
        {#if canShare}
          <Button
            class="input flex w-12 shrink-0 items-center justify-center p-0"
            onclick={shareProfile}>
            <Icon icon={Upload} />
          </Button>
        {/if}
        <label class="input flex min-w-0 flex-1 items-center gap-2">
          <Icon icon={LinkRound} class="shrink-0" />
          <input readonly class="min-w-0 grow truncate" value={code} />
          <Button class="shrink-0" onclick={copyCode}>
            <Icon icon={Copy} />
          </Button>
        </label>
      </div>
      <p class="text-sm opacity-75">Tap the QR code to copy this profile link.</p>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button onclick={back} class="button button-link">
      <Icon icon={AltArrowLeft} />
      Go Back
    </Button>
  </ModalFooter>
</Modal>
