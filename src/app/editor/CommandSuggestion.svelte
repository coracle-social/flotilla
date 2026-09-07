<script lang="ts">
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {getCommandByAddress} from "@app/commands"

  type Props = {
    value: string
    url: string
  }

  const {value, url}: Props = $props()

  const command = getCommandByAddress(url, value)
</script>

<div class="flex max-w-full gap-3">
  <div class="py-1">
    <ProfileCircle pubkey={command?.author() ?? ""} {url} />
  </div>
  <div class="flex min-w-0 flex-col">
    <div class="flex items-center gap-2">
      <span class="text-bold">/{command?.command()}</span>
      <span class="overflow-hidden text-ellipsis text-sm opacity-75">
        @<ProfileName pubkey={command?.author() ?? ""} {url} />
      </span>
    </div>
    <div class="overflow-hidden text-ellipsis text-sm opacity-75">
      {command?.description()}
    </div>
  </div>
</div>
