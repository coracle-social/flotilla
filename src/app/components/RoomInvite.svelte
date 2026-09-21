<script lang="ts">
  import {onMount} from "svelte"
  import {displayRelayUrl} from "@welshman/util"
  import {Share} from "@capacitor/share"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Upload from "@assets/icons/upload.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {Access, makeInviteLink} from "@app/access"
  import {PLATFORM_NAME} from "@app/env"
  import {clip} from "@app/toast"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const access = new Access(url)
  const {claim, loading, roomCode} = access
  const inviteStatus = access.createInviteStatus(true)

  const back = () => history.back()
  const copyInvite = () => clip(invite)

  const shareInvite = async () => {
    if (!canShare) {
      return
    }

    try {
      await Share.share({url: invite})
    } catch (e) {
      console.error(e)
    }
  }

  let canShare = $state(false)
  let invite = $derived(makeInviteLink({url, claim: $claim, h, code: $roomCode}))

  onMount(async () => {
    try {
      const {value} = await Share.canShare()
      canShare = value
    } catch {
      canShare = false
    }

    await access.prepareInvite(h)
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Room Invite</ModalTitle>
      <ModalSubtitle>
        Get a link to invite people to
        <RoomName {url} {h} class="text-primary" />
        in <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <div>
      {#if $inviteStatus === "loading"}
        <p class="flex justify-center items-center">
          <Spinner loading={$loading}>Requesting an invite link...</Spinner>
        </p>
      {:else if $inviteStatus === "network"}
        <p class="flex justify-center items-center">
          Unable to reach the space. Please check your connection and try again.
        </p>
      {:else if $inviteStatus === "auth"}
        <p class="flex justify-center items-center">
          Oops! It looks like you're not allowed to create invites for this room.
        </p>
      {:else if $inviteStatus === "failed"}
        <p class="flex justify-center items-center">Unable to create a room invite code.</p>
      {:else}
        <div class="flex flex-col items-center gap-6">
          <div class="w-48">
            <QRCode code={invite} />
          </div>
          <Field>
            {#snippet input()}
              <div class="flex w-full gap-2">
                {#if canShare}
                  <Button
                    class="input flex w-12 shrink-0 items-center justify-center p-0"
                    onclick={shareInvite}>
                    <Icon icon={Upload} />
                  </Button>
                {/if}

                <label class="input flex min-w-0 flex-1 items-center gap-2">
                  <Icon icon={LinkRound} class="shrink-0" />
                  <input bind:value={invite} class="min-w-0 flex-1 truncate" type="text" readonly />
                  <Button class="shrink-0" onclick={copyInvite}>
                    <Icon icon={Copy} />
                  </Button>
                </label>
              </div>
            {/snippet}
            {#snippet info()}
              <p>
                This invite link includes access to the space and room. Anyone with the link can
                join by opening it in {PLATFORM_NAME}.
                {#if $inviteStatus === "noclaim"}
                  We weren't able to get an invite code from this space, so additional steps might
                  be required.
                {:else if !$claim}
                  This space did not issue a claim for this link, so additional steps might be
                  required.
                {/if}
              </p>
            {/snippet}
          </Field>
        </div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Done</Button>
  </ModalFooter>
</Modal>
