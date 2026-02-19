<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {dissoc, maybe} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import SpaceJoinSettings from "@app/components/SpaceJoinSettings.svelte"
  import {
    attemptRelayAccess,
    addSpaceMembership,
    broadcastUserData,
    setSpaceNotifications,
  } from "@app/core/commands"
  import {relaysMostlyRestricted, notificationSettings} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {makeSpacePath} from "@app/util/routes"
  import {Push} from "@app/util/notifications"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  const join = async () => {
    if (error) {
      return pushModal(SpaceAccessRequest, {url, callback: back})
    }

    loading = true

    try {
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
    } catch (e) {
      console.error("Failed to join space:", e)
      pushToast({theme: "error", message: "Failed to join space. Please try again."})
    } finally {
      loading = false
    }
  }

  let error = $state(maybe<string>())
  let loading = $state(true)
  let notifications = $state(true)

  onMount(async () => {
    error = await attemptRelayAccess(url)
    loading = false
  })
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <RelaySummary {url} />
    <SpaceJoinSettings {url} bind:error bind:notifications />
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>
        {error ? "Request Access" : "Join Space"}
      </Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
