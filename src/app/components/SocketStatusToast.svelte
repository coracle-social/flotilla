<script lang="ts">
  import {onDestroy} from "svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {deriveSocketStatus} from "@app/relays"
  import {pushToast, popToast} from "@app/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const status = deriveSocketStatus(url)

  let toastId: string | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined

  const hide = () => {
    clearTimeout(timeout)
    timeout = undefined

    if (toastId) {
      popToast(toastId)
      toastId = undefined
    }
  }

  $effect(() => {
    if ($status.theme !== "warning") {
      hide()
      return
    }

    if (toastId || timeout) {
      return
    }

    // deriveSocketStatus is throttled, so a socket that opens at once still reports "Connecting".
    timeout = setTimeout(() => {
      timeout = undefined
      toastId = pushToast({
        timeout: 60_000,
        children: {component: SocketStatusIndicator, props: {url}},
      })
    }, 1000)
  })

  onDestroy(hide)
</script>
