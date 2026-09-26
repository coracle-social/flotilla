<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ContentLinkBlockImage from "@app/components/ContentLinkBlockImage.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const back = () => history.back()
</script>

<Button class="m-auto h-screen w-screen cursor-pointer p-4" onclick={back}>
  <ContentLinkBlockImage {url} {event} class="m-auto max-h-full max-w-full rounded-2xl" />
</Button>
