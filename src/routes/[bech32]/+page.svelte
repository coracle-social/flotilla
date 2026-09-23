<script lang="ts">
  import {onMount} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import type {TrustedEvent} from "@welshman/util"
  import {Address, NOTE, getIdFilters} from "@welshman/util"
  import {LOCAL_RELAY_URL} from "@welshman/net"
  import {goto} from "$app/navigation"
  import {decodePubkey} from "@lib/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import {network} from "@app/core"
  import {goToEvent, goToNote, makeProfilePath} from "@app/routes"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {bech32} = params

  const attemptToNavigate = async () => {
    const profilePubkey = decodePubkey(bech32)

    if (profilePubkey) {
      return goto(makeProfilePath(profilePubkey), {replaceState: true})
    }

    const {type, data} = nip19.decode(bech32) as any

    if (!["nevent", "naddr"].includes(type) && data.relays.length > 0) {
      return goto("/", {replaceState: true})
    }

    let found = false

    $network.loadComplete({
      relays: [LOCAL_RELAY_URL, ...data.relays],
      filters: getIdFilters([type === "nevent" ? data.id : Address.fromNaddr(bech32).toString()]),
      onEvent: (event: TrustedEvent) => {
        found = true

        if (event.kind === NOTE) {
          goToNote({id: event.id, pubkey: event.pubkey, relays: data.relays})
        } else {
          goToEvent(event, {replaceState: true})
        }
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
