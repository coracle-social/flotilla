<script lang="ts">
  import cx from "classnames"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import * as pages from "@app/navigation/pages"

  type Props = {
    h: string
    url: string
    class?: string
    unstyled?: boolean
  }

  const {h, url, unstyled, ...props}: Props = $props()

  const path = pages.room.path({url, h})
</script>

<Link href={path} class={cx(props.class, {"link-content": !unstyled})}>
  #<RoomName {h} {url} />
</Link>
