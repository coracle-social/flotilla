<script lang="ts">
  import cx from "classnames"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {makeSpacePath} from "@app/util/routes"

  type Props = {
    h: string
    url: string
    class?: string
    unstyled?: boolean
  }

  const {h, url, unstyled, ...props}: Props = $props()

  const path = makeSpacePath(url, h)
</script>

<Link href={path} class={cx(props.class, {"link-content bg-alt": !unstyled})}>
  #<RoomName {h} {url} />
</Link>
