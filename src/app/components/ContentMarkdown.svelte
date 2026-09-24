<script lang="ts" module>
  import DOMPurify from "dompurify"

  // A leading slash would also match a protocol-relative `//evil.com`.
  const isEntityPath = (href: string) =>
    Boolean(href.match(/^\/n(event|ote|pub|profile|addr)1\w+$/))

  // DOMPurify's defaults keep `style` and `form`, so allow only what marked emits.
  const SANITIZE_OPTIONS = {
    ALLOWED_TAGS: [
      "a",
      "blockquote",
      "br",
      "code",
      "del",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
    ALLOWED_ATTR: ["align", "alt", "href", "rel", "src", "start", "target", "title"],
  }

  // DOMPurify has no option for target, and its hooks live on the instance rather than per render.
  DOMPurify.addHook("afterSanitizeAttributes", node => {
    if (node.tagName === "A" && !isEntityPath(node.getAttribute("href") ?? "")) {
      node.setAttribute("target", "_blank")
      node.setAttribute("rel", "noopener noreferrer")
    }
  })
</script>

<script lang="ts">
  import {marked} from "marked"
  import * as nip19 from "nostr-tools/nip19"
  import {navigate} from "@app/modal"
  import {removeUndefined, tryCatch} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fromNostrURI} from "@welshman/util"
  import {deriveDisplaysByPubkey} from "@app/social"

  type Props = {
    event: TrustedEvent
    url?: string
    class?: string
  }

  const {event, url, class: className}: Props = $props()

  const entityPattern = /(nostr:)?n(event|ote|pub|profile|addr)\w{10,1000}/g

  // A display name is attacker-controlled, and `](` in one would re-point its own link.
  const escapeMarkdown = (text: string) => text.replace(/[\\[\]<`*_]/g, "\\$&")

  const pubkeyFromEntity = (entity: string) => {
    const {type, data} = nip19.decode(entity)

    if (type === "npub") {
      return data
    }
    if (type === "nprofile") {
      return data.pubkey
    }
  }

  // A display is bech32 until the profile arrives, and nothing would parse the markdown again.
  const mentionedPubkeys = $derived(
    removeUndefined(
      Array.from(event.content.matchAll(entityPattern)).map(([match]) =>
        tryCatch(() => pubkeyFromEntity(fromNostrURI(match))),
      ),
    ),
  )

  const displays = $derived(deriveDisplaysByPubkey(mentionedPubkeys, url))

  // Bech32 entities aren't markdown, so swap them for links before parsing.
  const linkEntities = (markdown: string) =>
    markdown.replace(entityPattern, match => {
      const entity = fromNostrURI(match)
      const pubkey = tryCatch(() => pubkeyFromEntity(entity))
      const name = pubkey ? $displays.get(pubkey) : undefined

      // An entity with no name to show still reads better truncated than as raw bech32
      const display = name ? "@" + name : entity.slice(0, 16) + "…"

      return `[${escapeMarkdown(display)}](/${entity})`
    })

  const html = $derived(
    DOMPurify.sanitize(marked.parse(linkEntities(event.content), {async: false}), SANITIZE_OPTIONS),
  )

  // Entity links point at the app's own bech32 route, so route them rather than reloading.
  const onclick = (clickEvent: MouseEvent) => {
    const href = (clickEvent.target as HTMLElement).closest("a")?.getAttribute("href") ?? undefined

    if (href && isEntityPath(href)) {
      clickEvent.preventDefault()
      navigate(href)
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div {onclick} class="content-markdown flex flex-col gap-4 overflow-hidden leading-6 {className}">
  {@html html}
</div>
