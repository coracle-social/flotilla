<script module lang="ts">
  import {goto} from "$app/navigation"
  import {ROOM_META} from "@welshman/util"
  import {load} from "@welshman/net"
  import {makeSpacePath} from "@app/util/routes"
  import {addSpaceMembership, broadcastUserData} from "@app/core/commands"
  import {pushToast} from "@app/util/toast"

  export const confirmSpaceJoin = async (url: string) => {
    await addSpaceMembership(url)

    const path = makeSpacePath(url)

    if (window.location.pathname === path) {
      load({
        relays: [url],
        filters: [{kinds: [ROOM_META]}],
      })
    }

    broadcastUserData([url])

    goto(path, {replaceState: true})

    pushToast({
      message: "Welcome to the space!",
    })
  }
</script>

<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const confirm = () => confirmSpaceJoin(url)
</script>

<Confirm
  {confirm}
  message="This space does not appear to limit who can post to it. This can result in a large amount of spam or other objectionable content. Continue?" />
