<script lang="ts">
  import {page} from "$app/stores"
  import {MembershipStatus} from "@welshman/app"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Login2 from "@assets/icons/login-3.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {joinRoom, leaveRoom} from "@app/access"
  import {deriveUserRoomMembershipStatus} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h: string
    label: string
    onJoin: () => void
  }

  const {url, h, label, onJoin}: Props = $props()

  const membershipStatus = deriveUserRoomMembershipStatus(url, h)
  const inviteCode = $derived($page.url.searchParams.get("code") || "")

  const join = async () => {
    joining = true

    try {
      const message = await joinRoom(url, h, inviteCode)

      if (message) {
        pushToast({theme: "error", message})
      } else {
        onJoin()
      }
    } finally {
      joining = false
    }
  }

  const leave = async () => {
    leaving = true

    try {
      const message = await leaveRoom(url, h)

      if (message) {
        pushToast({theme: "error", message})
      } else {
        pushToast({message: "You have left the room."})
      }
    } finally {
      leaving = false
    }
  }

  let joining = $state(false)
  let leaving = $state(false)
</script>

{#if $membershipStatus === MembershipStatus.Pending}
  <Button class="button button-neutral button-sm" disabled={leaving} onclick={leave}>
    <Icon icon={ClockCircle} />
    Access Pending
  </Button>
{:else}
  <Button class="button button-neutral button-sm" disabled={joining} onclick={join}>
    {#if joining}
      <Spinner size="sm" />
    {:else}
      <Icon icon={Login2} />
    {/if}
    {label}
  </Button>
{/if}
