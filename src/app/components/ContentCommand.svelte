<script lang="ts">
  import type {ParsedCommandValue} from "@welshman/content"
  import type {CommandReader} from "@welshman/domain"
  import ProfileName from "@app/components/ProfileName.svelte"

  type Props = {
    command: CommandReader
    value: ParsedCommandValue
  }

  const {command, value}: Props = $props()
</script>

<span class="tiptap-object tip tip-top" data-tip={command.description()}>
  /{command.command()}{#if value.pubkey}@<ProfileName pubkey={value.pubkey} />{/if}
</span>
