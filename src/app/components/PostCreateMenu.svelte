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
  import {withLogin} from "@app/components/flows/login"

  type Props = {
    includePost?: boolean
    onClick: () => void
  }

  const {includePost = true, onClick}: Props = $props()

  const createPost = () => withLogin("write a post", () => pushModal(NoteCreate))

  const createPoll = () => withLogin("create a poll", () => pushModal(PollCreate))

  const createArticle = () =>
    withLogin("write an article", () => navigate(pages.networkArticleCreate.path()))
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if includePost}
    <li>
      <Button onclick={createPost}>
        <Icon size={4} icon={PenNewSquare} />
        Create post
      </Button>
    </li>
  {/if}
  <li>
    <Button onclick={createPoll}>
      <Icon size={4} icon={Revote} />
      Create poll
    </Button>
  </li>
  <li>
    <Button onclick={createArticle}>
      <Icon size={4} icon={DocumentText} />
      Create article
    </Button>
  </li>
</ul>
