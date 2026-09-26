<script lang="ts">
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    onDelete: () => void
    onClick: () => void
  }

  const {onDelete, onClick}: Props = $props()
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={onDelete}>
      <Icon icon={TrashBin2} />
      Delete Session
    </Button>
  </li>
</ul>
