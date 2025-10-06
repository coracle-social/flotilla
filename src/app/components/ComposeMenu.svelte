<script lang="ts">
  import {onMount} from "svelte"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {pushModal} from "@app/util/modal"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"

  type Props = {
    url: string
    onClick: () => void
    room?: string
  }

  const {url, room, onClick}: Props = $props()

  const createGoal = () => pushModal(GoalCreate, {url, room})

  const createCalendarEvent = () => pushModal(CalendarEventCreate, {url, room})

  const createThread = () => pushModal(ThreadCreate, {url, room})

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-box bg-base-100 p-2 shadow-xl" bind:this={ul}>
  <li>
    <Button onclick={createGoal}>
      <Icon size={4} icon={StarFallMinimalistic} />
      Create Funding Goal
    </Button>
  </li>
  <li>
    <Button onclick={createCalendarEvent}>
      <Icon size={4} icon={CalendarMinimalistic} />
      Create Calendar Event
    </Button>
  </li>
  <li>
    <Button onclick={createThread}>
      <Icon size={4} icon={NotesMinimalistic} />
      Create Thread
    </Button>
  </li>
</ul>
