<script lang="ts">
  import {removeNil} from "@welshman/lib"
  import {deriveProfile} from "@welshman/app"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  export type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const profile = deriveProfile(pubkey, removeNil([url]))
</script>

{#if $profile}
  <ContentMinimal event={{content: $profile.about || "", tags: []}} />
{/if}
