<script lang="ts">
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import Revote from "@assets/icons/revote.svg?dataurl"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import NoteCreate from "@app/components/NoteCreate.svelte"
  import PollCreate from "@app/components/PollCreate.svelte"
  import {navigate} from "@app/navigation/navigate"
  import {pushModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"

  type Props = {
    onClick: () => void
    post?: boolean
  }

  const {onClick, post = false}: Props = $props()

  const createPost = () => pushModal(NoteCreate)

  const createPoll = () => pushModal(PollCreate)

  const createArticle = () => navigate(pages.networkArticleCreate.path())
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if post}
    <li>
      <Button onclick={createPost}>
        <Icon size={4} icon={PenNewSquare} />
        Post
      </Button>
    </li>
  {/if}
  <li>
    <Button onclick={createPoll}>
      <Icon size={4} icon={Revote} />
      Poll
    </Button>
  </li>
  <li>
    <Button onclick={createArticle}>
      <Icon size={4} icon={DocumentText} />
      Article
    </Button>
  </li>
</ul>
