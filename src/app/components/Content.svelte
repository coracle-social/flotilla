<script lang="ts">
  import {tagSpec, tagValue} from "@welshman/util"
  import {
    parse,
    truncate,
    renderAsHtml,
    isText,
    isEmail,
    isEmoji,
    isTopic,
    isCode,
    isCommand,
    isCashu,
    isInvoice,
    isLink,
    isProfile,
    isRoom,
    isEvent,
    isEllipsis,
    isAddress,
    isNewline,
  } from "@welshman/content"
  import type {Parsed} from "@welshman/content"
  import {preventDefault, stopPropagation} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Card from "@lib/components/Card.svelte"
  import ContentToken from "@app/components/ContentToken.svelte"
  import ContentEmoji from "@app/components/ContentEmoji.svelte"
  import ContentEmail from "@app/components/ContentEmail.svelte"
  import ContentCode from "@app/components/ContentCode.svelte"
  import ContentLinkInline from "@app/components/ContentLinkInline.svelte"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"
  import ContentNewline from "@app/components/ContentNewline.svelte"
  import ContentQuote from "@app/components/ContentQuote.svelte"
  import ContentTopic from "@app/components/ContentTopic.svelte"
  import ContentCommand from "@app/components/ContentCommand.svelte"
  import ContentMention from "@app/components/ContentMention.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {makeRoomPath} from "@app/routes"
  import {deriveValidCommands, getCommandsForInvocation} from "@app/commands"
  import {userSettingsValues} from "@app/settings"

  type Props = {
    event: any
    minLength?: number
    maxLength?: number
    showEntire?: boolean
    expandMode?: string
    trimParent?: boolean
    url?: string
  }

  let {
    event,
    minLength = 500,
    maxLength = 700,
    showEntire = $bindable(false),
    expandMode = "block",
    trimParent = false,
    url,
  }: Props = $props()

  // An invocation is plain text, so it is only recognizable against the space's own definitions.
  const available = deriveValidCommands({
    url,
    kind: event.kind,
    pubkey: event.pubkey,
    tags: event.tags,
  })

  const fullContent = $derived(parse(event))

  const expand = () => {
    showEntire = true
  }

  const isBlock = (i: number) => {
    const parsed = fullContent[i]

    if (!parsed) {
      return false
    }

    if (isLink(parsed) && $userSettingsValues.show_media && isStartAndEnd(i)) {
      return true
    }

    if (isQuote(parsed) && isStartAndEnd(i)) {
      return true
    }

    return false
  }

  const isBoundary = (i: number) => {
    const parsed = fullContent[i]

    if (!parsed || isNewline(parsed)) {
      return true
    }
    if (isText(parsed)) {
      return Boolean(parsed.value.match(/^\s+$/))
    }

    return false
  }

  const isStart = (i: number) => isBoundary(i - 1)

  const isEnd = (i: number) => isBoundary(i + 1)

  const isStartAndEnd = (i: number) => isStart(i) && isEnd(i)

  const isQuote = (p: Parsed) => isEvent(p) || isAddress(p)

  let warningDismissed = $state(false)

  const ignoreWarning = () => {
    warningDismissed = true
  }

  const warning = $derived(
    warningDismissed
      ? undefined
      : $userSettingsValues.hide_sensitive && tagValue(tagSpec("content-warning"), event.tags),
  )

  const dropWhile = <T,>(f: (x: T) => boolean, xs: Iterable<T>) => {
    const result: T[] = []

    for (const x of xs) {
      if (result.length === 0 && f(x)) {
        continue
      }

      result.push(x)
    }

    return result
  }

  const shortContent = $derived.by(() => {
    let result = fullContent

    if (trimParent && result.length > 0 && isQuote(result[0])) {
      result = dropWhile(p => isQuote(p) || isNewline(p), result)
    }

    if (!showEntire) {
      result = truncate(result, {
        minLength,
        maxLength,
        mediaLength: 200,
      })
    }

    return result
  })

  const hasEllipsis = $derived(shortContent.some(isEllipsis))
  const expandInline = $derived(hasEllipsis && expandMode === "inline")
  const expandBlock = $derived(hasEllipsis && expandMode === "block")
</script>

<div class="relative">
  {#if warning}
    <Card sm class="shadow-none flex gap-2">
      <Icon icon={Danger} />
      <p>
        This note has been flagged by the author as "{warning}".<br />
        <Button onclick={ignoreWarning} class="button button-link">Show anyway</Button>
      </p>
    </Card>
  {:else}
    <div
      class="overflow-hidden text-ellipsis wrap-anywhere"
      style={expandBlock ? "mask-image: linear-gradient(0deg, transparent 0px, black 100px)" : ""}>
      {#each shortContent as parsed, i (i)}
        {#if isCommand(parsed)}
          {@const command = getCommandsForInvocation($available, parsed.value)[0]}
          {#if command}
            <ContentCommand {command} value={parsed.value} />
          {:else}
            {@html renderAsHtml(parsed)}
          {/if}
        {:else if isNewline(parsed) && !isBlock(i - 1)}
          <ContentNewline value={parsed.value} />
        {:else if isTopic(parsed)}
          <ContentTopic value={parsed.value} />
        {:else if isEmoji(parsed)}
          <ContentEmoji value={parsed.value} />
        {:else if isEmail(parsed)}
          <ContentEmail value={parsed.value} />
        {:else if isCode(parsed)}
          <ContentCode
            value={parsed.value}
            isBlock={isStartAndEnd(i) || parsed.value.includes("\n")} />
        {:else if isCashu(parsed) || isInvoice(parsed)}
          <ContentToken value={parsed.value} />
        {:else if isLink(parsed)}
          {#if isBlock(i)}
            <ContentLinkBlock value={parsed.value} {event} />
          {:else}
            <ContentLinkInline value={parsed.value} {event} />
          {/if}
        {:else if isProfile(parsed)}
          <ContentMention value={parsed.value} {url} />
        {:else if isRoom(parsed)}
          <Link href={makeRoomPath(parsed.value.url, parsed.value.room)} class="link-content">
            #<RoomName url={parsed.value.url} h={parsed.value.room} />
          </Link>
        {:else if isQuote(parsed)}
          <ContentQuote {url} value={parsed.value} raw={parsed.raw} {event} inline={!isBlock(i)} />
        {:else if isEllipsis(parsed) && expandInline}
          {@html renderAsHtml(parsed)}
          <button
            type="button"
            class="pointer-events-auto text-sm underline"
            onclick={stopPropagation(preventDefault(expand))}>
            Read more
          </button>
        {:else}
          {@html renderAsHtml(parsed)}
        {/if}
      {/each}
    </div>
    {#if expandBlock}
      <div class="relative z-feature -mt-6 flex justify-center py-2">
        <Button onclick={stopPropagation(preventDefault(expand))} class="button button-neutral">
          See more
        </Button>
      </div>
    {/if}
  {/if}
</div>
