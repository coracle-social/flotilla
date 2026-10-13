<script lang="ts">
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {roomLists} from "@app/core/plugins"
  import {makeSpacePath} from "@app/ui/routes"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const spaceUrls = $roomLists.urls(pubkey).$

  const back = () => history.back()
</script>

<div class="flex flex-col gap-2">
  {#each $spaceUrls as url (url)}
    <div class="card flex flex-row items-center gap-2">
      <div class="shrink-0">
        <RelayIcon {url} size={12} />
      </div>
      <div class="flex grow flex-col">
        <RelayName {url} />
        <div class="text-sm opacity-75">
          {url}
        </div>
      </div>
      <Link class="button button-primary" href={makeSpacePath(url)}>
        Go to space
        <Icon icon={AltArrowRight} />
      </Link>
    </div>
  {:else}
    <div class="card text-center">
      <p class="opacity-75">No spaces found for this user</p>
    </div>
  {/each}
  <ModalFooter>
    <Button onclick={back} class="button button-link hidden md:flex">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</div>
