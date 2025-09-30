<script lang="ts">
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import GoalForm from "@app/components/GoalForm.svelte"

  const {url} = $props()
  const back = () => history.back()

</script>

<GoalForm url={url}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Create a Funding Goal</div>
      {/snippet}
      {#snippet info()}
        <div>Request contributions for your fundraiser.</div>
      {/snippet}
    </ModalHeader>
  {/snippet}

  {#snippet footer()}
    <ModalFooter>
      <Button class="btn btn-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button type="submit" class="btn btn-primary">Create Goal</Button>
    </ModalFooter>
  {/snippet}
</GoalForm>
