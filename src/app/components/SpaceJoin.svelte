<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {clearModals} from "@app/util/modal"
  import {addSpaceMembership, broadcastUserData} from "@app/core/commands"

  const {url} = $props()

  const back = () => history.back()

  const tryJoin = async () => {
    await addSpaceMembership(url)

    broadcastUserData([url])
    clearModals()
  }

  const join = async () => {
    loading = true

    try {
      await tryJoin()
    } catch (e) {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(join)}>
  <ModalHeader>
    {#snippet title()}
      <div>
        Joining <span class="text-primary">{displayRelayUrl(url)}</span>
      </div>
    {/snippet}
    {#snippet info()}
      <div>Are you sure you'd like to join this space?</div>
    {/snippet}
  </ModalHeader>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Join Space</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
