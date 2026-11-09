<script lang="ts">
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {profiles} from "@app/core/plugins"

  export type Props = {
    pubkey: string
    singleLine?: boolean
  }

  const {pubkey, singleLine}: Props = $props()

  const profile = $profiles.one(pubkey)
</script>

{#if $profile}
  <ContentMinimal event={{content: $profile.about() || "", tags: []}} {singleLine} />
{/if}
