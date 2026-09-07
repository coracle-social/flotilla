<script lang="ts">
  import type {CommandReader} from "@welshman/domain"

  type Props = {
    command: CommandReader
  }

  const {command}: Props = $props()
</script>

<span class="tiptap-object tip tip-top" data-tip={command.description()}>
  /{command.command()}
</span>
