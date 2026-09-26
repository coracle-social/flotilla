<script lang="ts">
  import cx from "classnames"
  import {removeAt, replaceAt, sleep} from "@welshman/lib"
  import {Capacitor} from "@capacitor/core"
  import {Badge} from "@capawesome/capacitor-badge"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ToggleInput from "@lib/components/ToggleInput.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import {pushToast} from "@app/toast"
  import {saveNotificationSettings} from "@app/push"
  import {notificationSettings} from "@app/settings"

  const reset = () => {
    settings = {...notificationSettings.get()}
  }

  const addReminder = () => {
    settings.reminder_minutes = [...settings.reminder_minutes, 60]
  }

  const removeReminder = (index: number) => {
    settings.reminder_minutes = removeAt(index, settings.reminder_minutes)
  }

  const onReminderInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement
    const index = Number(target.dataset.index)

    settings.reminder_minutes = replaceAt(index, Number(target.value), settings.reminder_minutes)
  }

  const onsubmit = preventDefault(async () => {
    loading = true

    try {
      if (settings.events && settings.reminder_minutes.some(minutes => minutes < 1)) {
        return pushToast({
          theme: "error",
          message: "A reminder must come at least a minute before the event starts.",
        })
      }

      const permission = await saveNotificationSettings($state.snapshot(settings))

      if (permission.startsWith("granted")) {
        pushToast({message: "Your settings have been saved!"})
      } else {
        await sleep(300)

        settings.push = false

        pushToast({
          theme: "error",
          message: `Failed to request notification permissions (${permission}).`,
        })
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to save your alert settings."})
    } finally {
      loading = false
    }
  })

  let loading = $state(false)
  let settings = $state({...notificationSettings.get()})
</script>

<form {onsubmit}>
  <PageContent>
    <div class="card flex flex-col gap-4 shadow-md">
      <strong class="flex items-center gap-3 text-lg">
        <Icon icon={Bell} />
        Alert Settings
      </strong>
      {#await Badge.isSupported()}
        <!-- pass -->
      {:then { isSupported }}
        {#if isSupported}
          <FieldInline>
            {#snippet label()}
              <p>Show badge for unread alerts</p>
            {/snippet}
            {#snippet input()}
              <ToggleInput bind:checked={settings.badge} />
            {/snippet}
          </FieldInline>
        {/if}
      {/await}
      {#if !Capacitor.isNativePlatform()}
        <FieldInline>
          {#snippet label()}
            <p>Play sound for new messages</p>
          {/snippet}
          {#snippet input()}
            <ToggleInput bind:checked={settings.sound} />
          {/snippet}
        </FieldInline>
      {/if}
      <FieldInline>
        {#snippet label()}
          <p>Enable push notifications</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={settings.push} />
        {/snippet}
      </FieldInline>
    </div>
    <div
      class={cx("card bg-surface flex flex-col gap-4 shadow-md", {
        "pointer-events-none opacity-50": !settings.badge && !settings.sound && !settings.push,
      })}>
      <strong class="text-lg">Alert Types</strong>
      <FieldInline>
        {#snippet label()}
          <p>Notify me about new messages in my spaces</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={settings.spaces} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <p>Always notify me when mentioned</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={settings.mentions} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <p>Notify me about new direct messages</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={settings.messages} />
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <p>Remind me about events I'm going to</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={settings.events} />
        {/snippet}
      </FieldInline>
      {#if settings.events}
        <div class="flex flex-col gap-2">
          <!-- eslint-disable-next-line svelte/require-each-key -->
          {#each settings.reminder_minutes as minutes, index}
            <div class="flex items-center gap-2">
              <Button
                class="button button-ghost button-sm"
                type="button"
                onclick={() => removeReminder(index)}>
                <Icon icon={TrashBin2} />
              </Button>
              <label class="input flex grow items-center gap-2">
                <input
                  type="number"
                  class="w-16"
                  data-index={index}
                  value={minutes}
                  oninput={onReminderInput} />
                <span class="text-sm opacity-75">minutes before it starts</span>
              </label>
            </div>
          {/each}
          <Button class="button button-link w-fit px-0" type="button" onclick={addReminder}>
            <Icon icon={AddCircle} size={5} />
            Add reminder
          </Button>
        </div>
      {/if}
    </div>
    <div class="card sticky -bottom-3 shadow-md flex flex-row items-center justify-between gap-4">
      <Button class="button button-neutral" onclick={reset} disabled={loading}
        >Discard Changes</Button>
      <Button type="submit" class="button button-primary" disabled={loading}>
        <Spinner {loading}>Save Changes</Spinner>
      </Button>
    </div>
  </PageContent>
</form>
