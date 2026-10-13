<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {profiles} from "@app/core/plugins"

  export type Props = {
    pubkey: string
    singleLine?: boolean
    url?: string
  }

  const {pubkey, url, singleLine}: Props = $props()

  const profile = $profiles.one(pubkey, removeUndefined([url]))
</script>

{#if $profile}
  <ContentMinimal event={{content: $profile.about() || "", tags: []}} {singleLine} />
{/if}
