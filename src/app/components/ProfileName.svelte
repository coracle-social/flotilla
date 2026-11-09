<script lang="ts">
  import {profiles} from "@app/core/plugins"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const profileDisplay = $profiles.display(pubkey).$
</script>

{$profileDisplay}
