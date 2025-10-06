<script lang="ts">
  import cx from "classnames"
  import Link from "@lib/components/Link.svelte"
  import ChannelName from "@app/components/ChannelName.svelte"
  import {makeSpacePath} from "@app/util/routes"

  type Props = {
    room: string
    url: string
    class?: string
    unstyled?: boolean
  }

  const {room, url, unstyled, ...props}: Props = $props()

  const path = makeSpacePath(url, room)
</script>

<Link href={path} class={cx(props.class, {"link-content bg-alt": !unstyled})}>
  #<ChannelName {room} {url} />
</Link>
