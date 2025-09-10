<script lang="ts">
  import ChatSquare from "@assets/icons/chat-square.svg?dataurl"
  import Check from "@assets/icons/check.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import {setChecked} from "@app/util/notifications"
  import {pushModal} from "@app/util/modal"

  const startChat = () => pushModal(ChatStart, {}, {replaceState: true})

  const markAsRead = () => {
    setChecked("/chat/*")
    history.back()
  }
</script>

<div class="col-2">
  <Button class="btn btn-primary" onclick={startChat}>
    <Icon size={5} icon={ChatSquare} />
    Start chat
  </Button>
  <Button class="btn btn-neutral" onclick={markAsRead}>
    <Icon size={5} icon={Check} />
    Mark all read
  </Button>
</div>
