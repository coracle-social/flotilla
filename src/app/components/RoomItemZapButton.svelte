<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()
</script>

<ZapButton aria-label="Send a zap" {url} {event} class="button button-xs button-neutral join-item">
  <Icon icon={Bolt} size={4} />
</ZapButton>
