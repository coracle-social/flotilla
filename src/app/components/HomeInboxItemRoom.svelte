<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import HomeInboxItemCard from "@app/components/HomeInboxItemCard.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import RoomName from "@app/components/RoomName.svelte"

  type Props = {
    path: string
    url: string
    h: string
    event: TrustedEvent
  }

  const {path, url, h, event}: Props = $props()
</script>

<HomeInboxItemCard {path} {url} {event}>
  {#snippet icon()}
    <RelayIcon {url} size={9} class="shrink-0" />
  {/snippet}
  {#snippet title()}
    <RoomName {url} {h} />
  {/snippet}
  {#snippet subtitle()}
    <RelayName {url} />
  {/snippet}
</HomeInboxItemCard>
