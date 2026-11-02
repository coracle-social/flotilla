<script lang="ts">
  import {relays} from "@app/core/plugins"

  type Props = {
    url: string
    class?: string
  }

  const {url, ...props}: Props = $props()

  const display = $derived($relays.display(url).$)
</script>

<span class={props.class}>
  {$display}
</span>
