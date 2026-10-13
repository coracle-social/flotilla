<script lang="ts">
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import {rooms} from "@app/core/plugins"
  import {pushModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url: string
    h: string
    pubkey: string
    onClick: () => void
  }

  const {url, h, pubkey, onClick}: Props = $props()

  const removeMember = () =>
    pushModal(Confirm, {
      title: "Remove Member",
      message: "Are you sure you want to remove this user from the room?",
      confirm: async () => {
        const command = await $rooms.removeMember(url, {h}, pubkey)
        const error = await command.publish().getError()

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been removed!"})
          history.back()
        }
      },
    })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button class="text-error" onclick={removeMember}>
      <Icon icon={MinusCircle} />
      Remove Member
    </Button>
  </li>
</ul>
