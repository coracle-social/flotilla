<script lang="ts">
  import Avatar from "@lib/components/Avatar.svelte"
  import {removeNil} from "@welshman/lib"
  import {deriveProfile} from "@welshman/app"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"

  type Props = {
    pubkey: string
    url?: string
  } & Record<string, any>

  const {pubkey, url, ...props}: Props = $props()

  const profile = deriveProfile(pubkey, removeNil([url]))
</script>

<Avatar src={$profile?.picture} icon={UserCircle} {...props} />
