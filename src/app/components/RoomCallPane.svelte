<script lang="ts">
  import cx from "classnames"
  import VideoCallContent from "@app/components/VideoCallContent.svelte"
  import CallControlBar from "@app/components/CallControlBar.svelte"
  import {VideoCallLayout, videoCallLayout} from "@app/call"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  // Only mounted while the call is connected here, so the layout alone says whether chat is open.
  const chatOpen = $derived($videoCallLayout === VideoCallLayout.Split)
</script>

<!-- The controls belong to the video, so they share its column and the chat panel
     runs the full height beside it. Below xl the open chat takes the pane over
     instead of sharing it, leaving this column to shrink to just the controls. -->
<div
  class={cx("flex min-h-0 min-w-0 flex-col max-xl:order-last", chatOpen ? "xl:flex-1" : "flex-1")}>
  <VideoCallContent {url} {h} class={cx(chatOpen && "max-xl:hidden")} />
  <div class="hide-on-keyboard flex shrink-0 items-center justify-center pb-2">
    <CallControlBar {url} {h} />
  </div>
</div>
