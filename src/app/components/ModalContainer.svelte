<script lang="ts">
  import Drawer from "@lib/components/Drawer.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import {modal, clearModals} from "@app/util/modal"

  const onKeyDown = (e: any) => {
    if (e.code === "Escape" && e.target === document.body) {
      clearModals()
    }
  }

  const m = $derived($modal)
</script>

<svelte:window onkeydown={onKeyDown} />

{#if m?.options?.drawer}
  <Drawer onClose={clearModals} {...m.options}>
    {#key m.id}
      <m.component {...m.props} />
    {/key}
  </Drawer>
{:else if m}
  <Dialog onClose={clearModals} {...m.options}>
    {#key m.id}
      <m.component {...m.props} />
    {/key}
  </Dialog>
{/if}
