<script lang="ts">
  import {onMount} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import type {TrustedEvent} from "@welshman/util"
  import {Address, NOTE, getIdFilters} from "@welshman/util"
  import {LOCAL_RELAY_URL} from "@welshman/net"
  import {goto} from "$app/navigation"
  import {decodePubkey} from "@lib/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import {app} from "@app/core/app"
  import {network} from "@app/core/plugins"
  import {goToEvent, goToNote, makeEventPath, makeProfilePath} from "@app/ui/routes"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {bech32} = params

  const findEvent = (idOrAddress: string, relays: string[] = []) => {
    let found = false

    $network.loadComplete({
      relays: [LOCAL_RELAY_URL, ...relays],
      filters: getIdFilters([idOrAddress]),
      onEvent: (event: TrustedEvent) => {
        found = true

        const path = makeEventPath(event, Array.from(app.get().tracker.getRelays(event.id)))

        // An event with no page of its own opens over home, not over this spinner.
        if (path && event.kind !== NOTE) {
          goToEvent(event, {replaceState: true})
        } else {
          goToNote({id: event.id, author: event.pubkey, relays})
        }
      },
      onClose: () => {
        if (!found) {
          goto("/", {replaceState: true})
        }
      },
    })
  }

  const attemptToNavigate = async () => {
    const profilePubkey = decodePubkey(bech32)

    if (profilePubkey) {
      await goto(makeProfilePath(profilePubkey), {replaceState: true})
    } else {
      const decoded = nip19.decode(bech32)

      if (decoded.type === "nevent") {
        findEvent(decoded.data.id, decoded.data.relays)
      } else if (decoded.type === "naddr") {
        findEvent(Address.fromNaddr(bech32).toString(), decoded.data.relays)
      } else {
        await goto("/", {replaceState: true})
      }
    }
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
