<script lang="ts">
  import RoomName from "@app/components/RoomName.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"

  interface Props {
    h: string
    url: string
    class?: string
  }

  const {url, h, ...props}: Props = $props()
</script>

<div class="flex flex-grow items-center justify-between gap-4 {props.class}">
  <div class="flex items-center gap-3">
    <RoomImage {url} {h} />
    <div class="min-w-0 overflow-hidden text-ellipsis">
      <RoomName {url} {h} />
    </div>
  </div>
</div>
