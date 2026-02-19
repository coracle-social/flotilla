<script lang="ts">
  import {debounce} from "throttle-debounce"
  import {dissoc, maybe} from "@welshman/lib"
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
  import SpaceJoinSettings from "@app/components/SpaceJoinSettings.svelte"
  import {pushToast} from "@app/util/toast"
  import {makeSpacePath} from "@app/util/routes"
  import {Push} from "@app/util/notifications"
  import {relaysMostlyRestricted, notificationSettings, parseInviteLink} from "@app/core/state"
  import {
    attemptRelayAccess,
    addSpaceMembership,
    broadcastUserData,
    setSpaceNotifications,
  } from "@app/core/commands"

  type Props = {
    invite: string
    back?: () => void
  }

  let {invite = "", back = () => history.back()}: Props = $props()

  const toggleScanner = () => {
    showScanner = !showScanner
  }

  const onScan = debounce(1000, async (data: string) => {
    showScanner = false
    invite = data
  })

  const joinRelay = async () => {
    const {url, claim} = inviteData!

    error = await attemptRelayAccess(url, claim)

    if (!error) {
      if (notifications) {
        if (!notificationSettings.get().push) {
          await setSpaceNotifications(url, true)
        } else {
          const permissions = await Push.request()

          if (permissions === "granted") {
            await setSpaceNotifications(url, true)
          }
        }
      } else {
        await setSpaceNotifications(url, false)
      }

      await addSpaceMembership(url)
      await goto(makeSpacePath(url), {replaceState: true})

      broadcastUserData([url])
      relaysMostlyRestricted.update(dissoc(url))
      pushToast({message: "Welcome to the space!"})
    }
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
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Join a Space</ModalTitle>
      <ModalSubtitle
        >Enter a relay URL or invite link below to join an existing space.</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Invite Link*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={LinkRound} />
          <input bind:value={invite} class="grow" type="text" />
          <Button onclick={toggleScanner} class="center">
            <Icon icon={QrCode} />
          </Button>
        </label>
      {/snippet}
    </Field>
    {#if showScanner}
      <Scanner onscan={onScan} />
    {/if}
    {#if inviteData}
      <div class="-my-4">
        <div transition:slideAndFade class="flex flex-col gap-4 py-4">
          <div class="card2 bg-alt flex flex-col gap-4">
            <p class="opacity-75">You're about to join:</p>
            <RelaySummary url={inviteData.url} />
            <SpaceJoinSettings url={inviteData.url} bind:error bind:notifications />
          </div>
        </div>
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={!inviteData || loading}>
      <Spinner {loading}>Join Space</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
