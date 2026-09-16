<script lang="ts">
  import {BlossomServerLists, MuteLists, publish} from "@welshman/app"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Field from "@lib/components/Field.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ToggleInput from "@lib/components/ToggleInput.svelte"
  import InputList from "@lib/components/InputList.svelte"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Card from "@lib/components/Card.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {blossomServerLists, deriveUserItem, muteLists} from "@app/core"
  import {pushToast} from "@app/toast"
  import {PLATFORM_NAME} from "@app/env"
  import {userSettingsValues, publishSettings, createSettingsForm} from "@app/settings"

  const userMuteList = deriveUserItem(MuteLists)
  const userBlossomServerList = deriveUserItem(BlossomServerLists)

  const reset = () => {
    settings.set({...$userSettingsValues})
    mutedPubkeys = $userMuteList?.pubkeys() ?? []
    blossomServers = $userBlossomServerList?.urls() ?? []
  }

  const addServer = () => {
    blossomServers = [...blossomServers, ""]
  }

  const onsubmit = preventDefault(async () => {
    loading = true

    try {
      await publishSettings($settings)

      await $muteLists
        .setMutes({publicTags: mutedPubkeys.map(pubkey => ["p", pubkey])})
        .then(publish)

      await $blossomServerLists.setUrls($state.snapshot(blossomServers)).then(publish)

      pushToast({message: "Your settings have been saved!"})
    } finally {
      loading = false
    }
  })

  const settings = createSettingsForm()
  let loading = $state(false)
  let mutedPubkeys = $state($userMuteList?.pubkeys() ?? [])
  let blossomServers = $state($userBlossomServerList?.urls() ?? [])
  let loadedMutes = Boolean($userMuteList)
  let loadedServers = Boolean($userBlossomServerList)

  // Both lists come off the wire, so on a fresh load they land after this page has mounted. Each
  // field takes its stored value up when it arrives, since a form that never saw it would publish
  // its own emptiness back over it.
  $effect(() => {
    if (!loadedMutes && $userMuteList) {
      loadedMutes = true
      mutedPubkeys = $userMuteList.pubkeys()
    }
  })

  $effect(() => {
    if (!loadedServers && $userBlossomServerList) {
      loadedServers = true
      blossomServers = $userBlossomServerList.urls()
    }
  })
</script>

<form {onsubmit}>
  <PageContent>
    <Card class="flex flex-col gap-4">
      <strong class="flex items-center gap-3 text-lg">
        <Icon icon={NotesMinimalistic} />
        Content Settings
      </strong>
      <FieldInline>
        {#snippet label()}
          <p>Hide sensitive content?</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={$settings.hide_sensitive} />
        {/snippet}
        {#snippet info()}
          <p>
            If content is marked by the author as sensitive, {PLATFORM_NAME} will hide it by default.
          </p>
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <p>Show media?</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput bind:checked={$settings.show_media} />
        {/snippet}
        {#snippet info()}
          <p>Use this to disable link previews and image rendering.</p>
        {/snippet}
      </FieldInline>
      <Field>
        {#snippet label()}
          <p>Muted Accounts</p>
        {/snippet}
        {#snippet input()}
          <div>
            <ProfileMultiSelect bind:value={mutedPubkeys} />
          </div>
        {/snippet}
      </Field>
    </Card>
    <Card class="flex flex-col gap-4 shadow-md">
      <strong class="text-lg">Editor Settings</strong>
      <Field>
        {#snippet label()}
          <p>Send Delay</p>
        {/snippet}
        {#snippet input()}
          <input
            class="range w-full"
            type="range"
            min="0"
            max="10000"
            step="1000"
            bind:value={$settings.send_delay} />
        {/snippet}
        {#snippet info()}
          <p>
            Delay sending chat messages for {$settings.send_delay / 1000}
            {$settings.send_delay === 1000 ? "second" : "seconds"}.
          </p>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>OpenRouter</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={Microphone} />
            <input
              bind:value={$settings.openrouter_key}
              autocomplete="off"
              name="flotilla-openrouter-key"
              placeholder="OpenRouter API key"
              class="grow"
              type="password" />
          </label>
        {/snippet}
        {#snippet info()}
          <p>
            Add an <Link external href="https://openrouter.ai/settings/keys" class="text-primary"
              >OpenRouter API key</Link> to transcribe what you record with the microphone button in your
            composer, and to have messages read out loud to you.
          </p>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Media Server</p>
        {/snippet}
        {#snippet secondary()}
          <Button class="link text-sm underline flex items-center gap-1" onclick={addServer}>
            <Icon icon={AddCircle} size={4} />
            Add Server
          </Button>
        {/snippet}
        {#snippet input()}
          <InputList allowAdd={false} bind:value={blossomServers} />
        {/snippet}
        {#snippet info()}
          <p>Choose a media server type and url for files you upload to {PLATFORM_NAME}.</p>
        {/snippet}
      </Field>
    </Card>
    <Card class="sticky -bottom-3 shadow-md flex flex-row items-center justify-between gap-4">
      <Button class="button button-neutral" onclick={reset} disabled={loading}
        >Discard Changes</Button>
      <Button class="button button-primary" type="submit" disabled={loading}>
        <Spinner {loading}>Save Changes</Spinner>
      </Button>
    </Card>
  </PageContent>
</form>
