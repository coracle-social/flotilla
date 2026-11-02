<script lang="ts">
  import cx from "classnames"
  import {removeUndefined} from "@welshman/lib"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {profiles} from "@app/core/plugins"

  type Props = {
    pubkey?: string
    class?: string
    style?: string
    size?: number
    url?: string
  }

  const {pubkey, url, size = 7, style = undefined, ...props}: Props = $props()

  const profile = $profiles.one(pubkey, removeUndefined([url]))
</script>

<ImageIcon
  {size}
  {style}
  alt=""
  class={cx(props.class, "rounded-full")}
  src={$profile?.picture() || UserRounded} />
