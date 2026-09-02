<script lang="ts">
  import {onMount} from "svelte"
  import {maybe} from "@welshman/lib"
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
  import SpaceJoinNotifications from "@app/components/SpaceJoinNotifications.svelte"
  import SpaceJoinStatus from "@app/components/SpaceJoinStatus.svelte"
  import {Access} from "@app/access"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {goToSpace} from "@app/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const access = new Access(url)

  const back = () => history.back()

  const join = async () => {
    if (error) {
      return pushModal(SpaceAccessRequest, {url, callback: back})
    }

    loading = true

    try {
      await access.completeJoin(notifications)

      pushToast({message: "Welcome to the space!"})
      await goToSpace(url, {replaceState: true})
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
    error = await access.attempt()
    loading = false
  })
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <RelaySummary {url} />
    <SpaceJoinNotifications bind:notifications />
    {#if error}
      <SpaceJoinStatus {url} {error} />
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>
        {error ? "Request Access" : "Join Space"}
      </Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
