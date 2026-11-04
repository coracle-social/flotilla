<script lang="ts">
  import Tuning from "@assets/icons/tuning-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceMemberManage from "@app/components/SpaceMemberManage.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    h: string
    pubkey: string
    onClick: () => void
  }

  const {url, h, pubkey, onClick}: Props = $props()

  const manageMember = () => pushModal(SpaceMemberManage, {url, h, pubkey}, {nested: true})
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={manageMember}>
      <Icon icon={Tuning} />
      Manage member
    </Button>
  </li>
</ul>
