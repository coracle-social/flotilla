import {ParsedType, isImage, parse} from "@welshman/content"
import type {Parsed} from "@welshman/content"
import type {TrustedEvent} from "@welshman/util"
import {profiles} from "@app/core"

// Welshman's text renderer resolves an entity or a link to the string it links to, so anything
// reading a message as text rather than rendering it as components gets a hundred characters of
// bech32 where a quote was. Everything that is not prose is named instead.
export const renderNode = (parsed: Parsed): string => {
  switch (parsed.type) {
    case ParsedType.Address:
      return "another post"
    case ParsedType.Cashu:
      return "a cashu token"
    case ParsedType.Code:
      return parsed.value
    case ParsedType.Command:
      return parsed.raw
    case ParsedType.Ellipsis:
      return "…"
    case ParsedType.Email:
      return parsed.value
    case ParsedType.Emoji:
      return parsed.value.name
    case ParsedType.Event:
      return "another message"
    case ParsedType.Invoice:
      return "a lightning invoice"
    case ParsedType.Link: {
      const {host} = parsed.value.url

      return isImage(parsed) ? "an image" : `a link to ${host}`
    }
    case ParsedType.LinkGrid:
      return "some images"
    case ParsedType.Newline:
      return parsed.value
    case ParsedType.Profile:
      return profiles.get().display(parsed.value.pubkey).get()
    case ParsedType.Room:
      return parsed.value.room
    case ParsedType.Text:
      return parsed.value
    case ParsedType.Topic:
      return parsed.value.slice(1)
  }
}

export const renderNodes = (parsed: Parsed[]) => parsed.map(renderNode).join("")

export const renderEventAsText = (event: TrustedEvent) => renderNodes(parse(event)).trim()

const splitLines = (parsed: Parsed[]) => {
  const lines: Parsed[][] = [[]]

  for (const node of parsed) {
    if (node.type === ParsedType.Newline) {
      lines.push([])
    } else {
      lines[lines.length - 1].push(node)
    }
  }

  return lines.filter(line => line.length > 0)
}

const hasProse = (line: Parsed[]) =>
  line.some(node => node.type === ParsedType.Text && node.value.trim().length > 0)

// A reply prepends the message it answers, so the first line of one describes the quote and says
// nothing about the reply. The first line carrying words of its own is what the message is about.
export const renderEventAsSummary = (event: TrustedEvent) => {
  const lines = splitLines(parse(event))
  const line = lines.find(hasProse) || lines[0] || []

  return renderNodes(line).trim()
}
