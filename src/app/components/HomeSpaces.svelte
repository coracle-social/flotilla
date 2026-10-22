<script lang="ts">
  import Compass from "@assets/icons/compass.svg?dataurl"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeSpacesItem from "@app/components/HomeSpacesItem.svelte"
  import {PLATFORM_RELAYS} from "@app/core/env"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()
</script>

<HomeSection title="Spaces" icon={Compass} class={className}>
  <div class="flex flex-col divide-y divide-line border-t border-line">
    {#each PLATFORM_RELAYS as url (url)}
      <HomeSpacesItem {url} />
    {/each}
  </div>
</HomeSection>
