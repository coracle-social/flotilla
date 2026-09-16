<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import type {Filter} from "@welshman/util"
  import {ROOMS, NOTE, FOLLOWS} from "@welshman/util"
  import {outbox} from "@welshman/util"
  import {PinLists} from "@welshman/app"
  import {decodePubkey} from "@lib/util"
  import Page from "@lib/components/Page.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ProfilePage from "@app/components/ProfilePage.svelte"
  import {pushToast} from "@app/toast"
  import {
    app,
    followLists,
    messagingRelayLists,
    network,
    profiles,
    relayLists,
    roomLists,
    router,
    user,
  } from "@app/core"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {npub} = params

  const pubkey = decodePubkey(npub)

  onMount(async () => {
    if (!pubkey) {
      return goto("/", {replaceState: true})
    }

    try {
      await $profiles.load(pubkey)
      await $relayLists.load(pubkey)

      const viewer = user.get().pubkey

      await Promise.all([
        $followLists.load(pubkey),
        $app.use(PinLists).load(pubkey),
        $roomLists.load(pubkey),
        $messagingRelayLists.load(pubkey),
        viewer && viewer !== pubkey ? $followLists.load(viewer) : undefined,
      ])

      const filters: Filter[] = [
        {authors: [pubkey], kinds: [ROOMS]},
        {authors: [pubkey], kinds: [NOTE], limit: 1},
      ]

      if (viewer === pubkey) {
        filters.push({kinds: [FOLLOWS], "#p": [pubkey], limit: 500})
      }

      $network.load({
        relays: await $router.resolver.relays([outbox(pubkey)]),
        filters,
      })
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Some of this profile could not be loaded."})
    }
  })
</script>

<Page>
  <PageContent class="p-0 md:p-4">
    {#if pubkey}
      <ProfilePage {pubkey} />
    {/if}
  </PageContent>
</Page>
