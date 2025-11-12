<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import {deriveRelay} from "@welshman/app"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import BillList from "@assets/icons/bill-list.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Button from "@lib/components/Button.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import SpaceEdit from "@app/components/SpaceEdit.svelte"
  import SpaceRelayStatus from "@app/components/SpaceRelayStatus.svelte"
  import RelayDescription from "@app/components/RelayDescription.svelte"
  import ProfileLatest from "@app/components/ProfileLatest.svelte"
  import {deriveUserIsSpaceAdmin} from "@app/core/state"
  import {pushModal} from "@app/util/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const relay = deriveRelay(url)
  const owner = $derived($relay?.pubkey)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const back = () => history.back()

  const startEdit = () => pushModal(SpaceEdit, {url, initialValues: $relay})
</script>

<div class="column gap-4">
  <div class="relative flex gap-4">
    <div class="relative">
      <div class="avatar relative">
        <div
          class="center !flex h-16 w-16 min-w-16 rounded-full border-2 border-solid border-base-300 bg-base-300">
          <RelayIcon {url} size={10} />
        </div>
      </div>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <h1 class="ellipsize whitespace-nowrap text-2xl font-bold">
        <RelayName {url} />
      </h1>
      <p class="ellipsize text-sm opacity-75">{displayRelayUrl(url)}</p>
    </div>
  </div>
  <RelayDescription {url} />
  {#if $relay?.terms_of_service || $relay?.privacy_policy}
    <div class="flex gap-3">
      {#if $relay.terms_of_service}
        <Link href={$relay.terms_of_service} class="badge badge-neutral flex gap-2">
          <Icon icon={BillList} size={4} />
          Terms of Service
        </Link>
      {/if}
      {#if $relay.privacy_policy}
        <Link href={$relay.privacy_policy} class="badge badge-neutral flex gap-2">
          <Icon icon={ShieldUser} size={4} />
          Privacy Policy
        </Link>
      {/if}
    </div>
  {/if}
  <SpaceRelayStatus {url} />
  <div class="flex flex-col gap-2">
    {#if owner}
      <div class="card2 bg-alt">
        <h3 class="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Icon icon={UserRounded} />
          Latest Updates
        </h3>
        <ProfileLatest {url} pubkey={owner}>
          {#snippet fallback()}
            <p class="text-sm opacity-60">No recent posts from the relay admin</p>
          {/snippet}
        </ProfileLatest>
      </div>
    {/if}
  </div>
  {#if $userIsAdmin}
    <ModalFooter>
      <Button class="btn btn-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button class="btn btn-primary" onclick={startEdit}>
        <Icon icon={Pen} />
        Edit Space
      </Button>
    </ModalFooter>
  {:else}
    <Button class="btn btn-primary" onclick={back}>Got it</Button>
  {/if}
</div>
