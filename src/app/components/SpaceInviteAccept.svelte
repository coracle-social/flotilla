<script lang="ts">
  import {debounce} from "throttle-debounce"
  import {maybe} from "@welshman/lib"
  import {goto} from "$app/navigation"
  import {preventDefault} from "@lib/html"
  import {slideAndFade} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Scanner from "@lib/components/Scanner.svelte"
  import QrCode from "@assets/icons/qr-code.svg?dataurl"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceJoinNotifications from "@app/components/SpaceJoinNotifications.svelte"
  import SpaceJoinStatus from "@app/components/SpaceJoinStatus.svelte"
  import {pushToast} from "@app/toast"
  import {goToSpace, makeRoomPath} from "@app/routes"
  import {Access, parseInviteLink} from "@app/access"

  type Props = {
    invite: string
    back?: () => void
    hideHeader?: boolean
  }

  let {invite = "", back = () => history.back(), hideHeader}: Props = $props()

  const toggleScanner = () => {
    showScanner = !showScanner
  }

  const onScan = debounce(1000, async (data: string) => {
    showScanner = false
    invite = data
  })

  const joinRelay = async () => {
    const data = inviteData!
    const access = new Access(data.url)

    error = await access.acceptInvite(data, notifications)

    if (error) {
      return
    }

    if (data.h) {
      const path = makeRoomPath(data.url, data.h)
      const qp = data.code ? `?code=${encodeURIComponent(data.code)}` : ""

      pushToast({message: "Welcome to the room!"})
      await goto(path + qp)
      return
    }

    pushToast({message: "Welcome to the space!"})
    await goToSpace(data.url, {replaceState: true})
  }

  const join = async () => {
    loading = true

    try {
      await joinRelay()
    } finally {
      loading = false
    }
  }

  let error = $state(maybe<string>())
  let loading = $state(false)
  let showScanner = $state(false)
  let notifications = $state(true)

  const inviteData = $derived(parseInviteLink(invite))
  const isRoomInvite = $derived(Boolean(inviteData?.h))
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    {#if !hideHeader}
      <ModalHeader>
        <ModalTitle>{isRoomInvite ? "Join a Room" : "Join a Space"}</ModalTitle>
        <ModalSubtitle>
          {#if isRoomInvite}
            Enter a room invite link below to join an existing room.
          {:else}
            Enter a relay URL or invite link below to join an existing space.
          {/if}
        </ModalSubtitle>
      </ModalHeader>
      <Field>
        {#snippet label()}
          <p>Invite Link*</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={LinkRound} />
            <input bind:value={invite} class="grow" type="text" />
            <Button onclick={toggleScanner} class="flex items-center justify-center">
              <Icon icon={QrCode} />
            </Button>
          </label>
        {/snippet}
      </Field>
      {#if showScanner}
        <Scanner onscan={onScan} />
      {/if}
    {/if}
    {#if inviteData}
      <div class="-my-4">
        <div transition:slideAndFade class="flex flex-col gap-4 py-4">
          <div class="card flex flex-col gap-4">
            <p class="opacity-75">You're about to join:</p>
            <RelaySummary url={inviteData.url} />
            <SpaceJoinNotifications bind:notifications />
            {#if error}
              <SpaceJoinStatus url={inviteData.url} {error} />
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!inviteData || loading}>
      <Spinner {loading}>{isRoomInvite ? "Join Room" : "Join Space"}</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
