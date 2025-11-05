<script lang="ts">
  import {goto} from "$app/navigation"
  import {displayRelayUrl} from "@welshman/util"
  import {parse, renderAsHtml} from "@welshman/content"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {preventDefault} from "@lib/html"
  import {ucFirst} from "@lib/util"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import {pushModal} from "@app/util/modal"
  import {removeSpaceMembership, publishLeaveRequest, removeTrustedRelay} from "@app/core/commands"

  const {url, error} = $props()

  const back = () => goto("/home")

  const requestAccess = () => pushModal(SpaceAccessRequest, {url})

  const leaveSpace = async () => {
    loading = true

    try {
      await removeSpaceMembership(url)
      await publishLeaveRequest({url})
      await removeTrustedRelay(url)
    } finally {
      loading = false
    }

    goto("/home")
  }

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(requestAccess)}>
  <ModalHeader>
    {#snippet title()}
      <div>Access Error</div>
    {/snippet}
    {#snippet info()}
      <div>We couldn't connect you to this space.</div>
    {/snippet}
  </ModalHeader>
  <p>
    We received an error from the relay indicating you don't have access to {displayRelayUrl(url)}:
  </p>
  <p class="bg-alt card2 welshman-content">
    {@html renderAsHtml(parse({content: ucFirst(error)}))}
  </p>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go Home
    </Button>
    <div class="flex gap-2">
      <Button class="btn btn-outline btn-error" onclick={leaveSpace} disabled={loading}>
        Leave Space
      </Button>
      <Button type="submit" class="btn btn-primary" disabled={loading}>
        Request Access
        <Icon icon={AltArrowRight} />
      </Button>
    </div>
  </ModalFooter>
</form>
