<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ThreadForm, {type Values} from "@app/components/ThreadForm.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"

  const {url} = $props()
  const back = () => history.back()
</script>

<ThreadForm url={url}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Create a Thread</div>
      {/snippet}
      {#snippet info()}
        <div>Share a link, or start a discussion.</div>
      {/snippet}
    </ModalHeader>
  {/snippet}
  {#snippet footer()}
    <div class="mt-4 flex flex-row items-center justify-between gap-4">
      <Button class="btn btn-neutral" onclick={back}>Back</Button>
      <Button type="submit" class="btn btn-primary">Create Thread</Button>
    </div>
  {/snippet}
</ThreadForm>