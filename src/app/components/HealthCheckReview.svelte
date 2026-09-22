<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import Stars from "@assets/icons/stars.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import type {HealthCheckPlan} from "@app/healthChecks"
  import {clearModals} from "@app/modal"

  type Props = {
    plans: HealthCheckPlan[]
  }

  const {plans}: Props = $props()

  const publishing = plans.filter(plan => plan.changes.length > 0)
  const interactive = plans.filter(plan => plan.changes.length === 0)

  let loading = $state(false)

  const back = () => history.back()

  const confirm = async () => {
    loading = true

    try {
      await Promise.all(publishing.map(plan => plan.apply()))
    } finally {
      loading = false
    }

    clearModals()

    for (const plan of interactive) {
      plan.apply()
    }
  }
</script>

<Modal tag="form" onsubmit={preventDefault(confirm)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Review changes</ModalTitle>
      <ModalSubtitle>Nothing changes until you confirm.</ModalSubtitle>
    </ModalHeader>
    {#each publishing as plan (plan.summary)}
      <div class="flex flex-col gap-2">
        <p>{plan.summary}</p>
        {#each plan.changes as change (change.label)}
          <div class="flex flex-col gap-1 rounded-xl bg-surface-more p-3">
            <strong class="text-sm">{change.label}</strong>
            {#each change.added as url (url)}
              <span class="flex min-w-0 items-center gap-2 text-sm">
                <Icon icon={AddCircle} size={4} class="shrink-0 text-success" />
                <span class="min-w-0 truncate">{displayRelayUrl(url)}</span>
              </span>
            {/each}
            {#each change.removed as url (url)}
              <span class="flex min-w-0 items-center gap-2 text-sm">
                <Icon icon={MinusCircle} size={4} class="shrink-0 text-error" />
                <span class="min-w-0 truncate">{displayRelayUrl(url)}</span>
              </span>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      {#if loading}
        <Spinner size="sm" />
      {:else}
        <Icon icon={Stars} size={4} />
      {/if}
      Confirm
    </Button>
  </ModalFooter>
</Modal>
