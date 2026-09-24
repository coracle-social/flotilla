import {ParsedType, parse, renderAsText, summarize} from "@welshman/content"
import type {Parsed, SummaryName} from "@welshman/content"
import type {TrustedEvent} from "@welshman/util"
import {profiles} from "@app/core"

const summaryName: SummaryName = parsed =>
  parsed.type === ParsedType.Profile ? profiles.get().display(parsed.value.pubkey).get() : undefined

const renderSummary = (parsed: Parsed[]) =>
  renderAsText(summarize(parsed, summaryName)).toString().trim()

export const renderEventAsText = (event: TrustedEvent) => renderSummary(parse(event))

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

// A reply prepends the message it answers, so the first line with words of its own is the summary.
export const renderEventAsSummary = (event: TrustedEvent) => {
  const lines = splitLines(parse(event))

  return renderSummary(lines.find(hasProse) || lines[0] || [])
}
