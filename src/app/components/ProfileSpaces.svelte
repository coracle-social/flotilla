<script lang="ts">
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SpaceAvatar from "@app/components/SpaceAvatar.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {makeSpacePath} from "@app/util/routes"
  import {getMembershipUrls, membershipsByPubkey} from "@app/core/state"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const spaceUrls = $derived(getMembershipUrls($membershipsByPubkey.get(pubkey)))

  const back = () => history.back()
</script>

<div class="flex flex-col gap-2">
  {#each spaceUrls as url (url)}
    <div class="card2 bg-alt flex flex-row items-center gap-2">
      <div class="flex-shrink-0">
        <SpaceAvatar {url} />
      </div>
      <div class="flex flex-grow flex-col">
        <RelayName {url} />
        <div class="text-sm opacity-75">
          {url}
        </div>
      </div>
      <Link class="btn btn-primary" href={makeSpacePath(url)}>
        Go to space
        <Icon icon={AltArrowRight} />
      </Link>
    </div>
  {:else}
    <div class="card2 bg-alt text-center">
      <p class="opacity-75">No spaces found for this user</p>
    </div>
  {/each}
  <ModalFooter>
    <Button onclick={back} class="hidden md:btn md:btn-link">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</div>
