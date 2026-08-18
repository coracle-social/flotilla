<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import DocumentText from "@assets/icons/document-text.svg?dataurl"
  import Revote from "@assets/icons/revote.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {pushModal} from "@app/modal"
  import {makeArticleCreatePath} from "@app/routes"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import ClassifiedCreate from "@app/components/ClassifiedCreate.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"
  import PollCreate from "@app/components/PollCreate.svelte"

  type Props = {
    url: string
    onClick: () => void
    h?: string
  }

  const {url, h, onClick}: Props = $props()

  const createGoal = () => pushModal(GoalCreate, {url, h, shareToChat: true})

  const createCalendarEvent = () => pushModal(CalendarEventCreate, {url, h, shareToChat: true})

  const createThread = () => pushModal(ThreadCreate, {url, h, shareToChat: true})

  const createClassified = () => pushModal(ClassifiedCreate, {url, h, shareToChat: true})

  const createPoll = () => pushModal(PollCreate, {url, h, shareToChat: true})

  const createArticle = () => goto(makeArticleCreatePath(url, {h, shareToChat: true}))

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={createGoal}>
      <Icon size={4} icon={StarFallMinimalistic} />
      Funding Goal
    </Button>
  </li>
  <li>
    <Button onclick={createCalendarEvent}>
      <Icon size={4} icon={CalendarMinimalistic} />
      Calendar Event
    </Button>
  </li>
  <li>
    <Button onclick={createClassified}>
      <Icon size={4} icon={CaseMinimalistic} />
      Classified Listing
    </Button>
  </li>
  <li>
    <Button onclick={createThread}>
      <Icon size={4} icon={NotesMinimalistic} />
      Create Thread
    </Button>
  </li>
  <li>
    <Button onclick={createArticle}>
      <Icon size={4} icon={DocumentText} />
      Write an Article
    </Button>
  </li>
  <li>
    <Button onclick={createPoll}>
      <Icon size={4} icon={Revote} />
      Ask a Question
    </Button>
  </li>
</ul>
