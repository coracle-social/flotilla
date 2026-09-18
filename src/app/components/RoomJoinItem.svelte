<script lang="ts">
  import {tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Card from "@lib/components/Card.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {app, relayManagement} from "@app/core"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {addRoomMembers} from "@app/rooms"

  type Props = {
    url: string
    event: TrustedEvent
    onResolved?: () => void
  }

  const {url, event, onResolved}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags) || ""

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canDismiss = $derived($supportedMethods.includes("banevent"))

  const showProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const dismiss = async () => {
    loading = true

    try {
      const {error} = await $relayManagement
        .forUrl(url)
        .banEvent(event.id, "Join request dismissed")

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Join request has been dismissed."})
        $app.repository.removeEvent(event.id)
        onResolved?.()
      }
    } finally {
      loading = false
    }
  }

  const accept = async () => {
    loading = true

    try {
      const error = await addRoomMembers(url, {h}, [event.pubkey])

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Member has been added to the room!"})
        onResolved?.()
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Card sm class="flex flex-col gap-4">
  <div class="flex justify-between gap-2">
    <div>
      <Button class="link text-primary" onclick={showProfile}>
        <ProfileName pubkey={event.pubkey} {url} />
      </Button>
      <span>
        requested membership in #<RoomName {url} {h} />
      </span>
    </div>
    <div class="flex gap-2">
      {#if canDismiss}
        <Button class="button button-neutral button-sm" onclick={dismiss} disabled={loading}
          >Dismiss</Button>
      {/if}
      <Button class="button button-primary button-sm" onclick={accept} disabled={loading}
        >Accept</Button>
    </div>
  </div>
</Card>
