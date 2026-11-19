<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {RoomJoin} from "@welshman/domain"
  import Button from "@lib/components/Button.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {app} from "@app/core/app"
  import {relayManagement} from "@app/core/plugins"
  import {reader} from "@app/core/domain"
  import {deriveSpacePermissions} from "@app/areas/spaces/management"
  import {pushModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"
  import {addRoomMembers} from "@app/areas/spaces/rooms"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    url: string
    event: TrustedEvent
    onResolved?: () => void
  }

  const {url, event, onResolved}: Props = $props()

  const h = reader(RoomJoin)(event).room() || ""

  const permissions = deriveSpacePermissions(url)

  const showProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const {loading: dismissing, submit: dismiss} = trackSubmit(
    () => "Failed to dismiss join request.",
    async () => {
      const {error} = await $relayManagement
        .forUrl(url)
        .banEvent(event.id, "Join request dismissed")

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Join request has been dismissed."})
        await $app.repository.removeEvent(event.id)
        onResolved?.()
      }
    },
  )

  const {loading: accepting, submit: accept} = trackSubmit(
    () => "Failed to add member to the room.",
    async () => {
      const error = await addRoomMembers(url, {h}, [event.pubkey])

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Member has been added to the room!"})
        onResolved?.()
      }
    },
  )

  const loading = $derived($dismissing || $accepting)
</script>

<div class="card card-sm flex flex-col gap-4">
  <div class="flex justify-between gap-2">
    <div>
      <Button class="link text-primary" onclick={showProfile}>
        <ProfileName pubkey={event.pubkey} />
      </Button>
      <span>
        requested membership in #<RoomName {url} {h} />
      </span>
    </div>
    <div class="flex gap-2">
      {#if $permissions.deleteContent}
        <Button class="button button-neutral button-sm" onclick={dismiss} disabled={loading}
          >Dismiss</Button>
      {/if}
      <Button class="button button-primary button-sm" onclick={accept} disabled={loading}
        >Accept</Button>
    </div>
  </div>
</div>
