<script lang="ts">
  import {onMount} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import type {MakeNonOptional} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Address, getIdFilters} from "@welshman/util"
  import {load, LOCAL_RELAY_URL} from "@welshman/net"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import Spinner from "@lib/components/Spinner.svelte"
  import {goToEvent} from "@app/util/routes"

  const {bech32} = $page.params as MakeNonOptional<typeof $page.params>

  const attemptToNavigate = async () => {
    const {type, data} = nip19.decode(bech32) as any

    if (!["nevent", "naddr"].includes(type) && data.relays.length > 0) {
      return goto("/", {replaceState: true})
    }

    let found = false

    load({
      relays: [LOCAL_RELAY_URL, ...data.relays],
      filters: getIdFilters([type === "nevent" ? data.id : Address.fromNaddr(bech32).toString()]),
      onEvent: (event: TrustedEvent) => {
        found = true
        goToEvent(event, {replaceState: true})
      },
      onClose: () => {
        if (!found) {
          goto("/", {replaceState: true})
        }
      },
    })
  }

  onMount(async () => {
    try {
      await attemptToNavigate()
    } catch (e) {
      goto("/", {replaceState: true})
    }
  })
</script>

<Spinner />
