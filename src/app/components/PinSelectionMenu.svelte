<script lang="ts">
  import type {PinboardReader} from "@welshman/domain"
  import FolderMove from "@assets/icons/folder-move.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    shelves: PinboardReader[]
    onMove: (address: string) => void
    onRemove: () => void
    onDelete: () => void
    onClick: () => void
  }

  const {shelves, onMove, onRemove, onDelete, onClick}: Props = $props()
</script>

<ul
  class="menu max-h-96 overflow-y-auto whitespace-nowrap rounded-2xl bg-surface p-2"
  onclickcapture={onClick}>
  {#each shelves as shelf (shelf.address())}
    <li>
      <Button onclick={() => onMove(shelf.address())}>
        <Icon icon={FolderMove} />
        Move to {shelf.title() || "Untitled shelf"}
      </Button>
    </li>
  {/each}
  <li>
    <Button onclick={onRemove}>
      <Icon icon={MinusCircle} />
      Take off this shelf
    </Button>
  </li>
  <li>
    <Button class="text-error" onclick={onDelete}>
      <Icon icon={TrashBin} />
      Delete links
    </Button>
  </li>
</ul>
