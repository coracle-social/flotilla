<script lang="ts">
  import {displayUrl} from "@welshman/lib"
  import {AuthStatus} from "@welshman/net"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SpaceJoinConfirm, {confirmSpaceJoin} from "@app/components/SpaceJoinConfirm.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {checkRelayAccess} from "@app/core/commands"
  import {deriveSocket} from "@app/core/state"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  const socket = deriveSocket(url)

  const join = async () => {
    loading = true

    try {
      const message = await checkRelayAccess(url, claim)

      if (message) {
        return pushToast({theme: "error", message, timeout: 30_000})
      }

      if ($socket.auth.status === AuthStatus.None) {
        pushModal(SpaceJoinConfirm, {url}, {replaceState: true})
      } else {
        await confirmSpaceJoin(url)
      }
    } finally {
      loading = false
    }
  }

  let claim = $state("")
  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(join)}>
  <ModalHeader>
    {#snippet title()}
      <div>Request Access</div>
    {/snippet}
    {#snippet info()}
      <div>Enter an invite code below to request access to {displayUrl(url)}.</div>
    {/snippet}
  </ModalHeader>
  <Field>
    {#snippet label()}
      <p>Invite code*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon={LinkRound} />
        <input bind:value={claim} class="grow" type="text" />
      </label>
    {/snippet}
  </Field>
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
