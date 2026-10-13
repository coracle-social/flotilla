import {marked} from "marked"

type MarkdownToken = {
  type?: string
  text?: string
  tokens?: MarkdownToken[]
  items?: MarkdownToken[]
}

// Markdown syntax reads as punctuation in a preview, so a body comes down to its prose.
const tokenToText = (token: MarkdownToken): string => {
  if (token.tokens) {
    return token.tokens.map(tokenToText).join("")
  }

  if (token.items) {
    return token.items.map(tokenToText).join(" ")
  }

  if (token.type === "space" || token.type === "br") {
    return " "
  }

  if (token.type === "code" || token.type === "html" || token.type === "image") {
    return ""
  }

  return token.text || ""
}

export const markdownToText = (markdown: string) =>
  marked.lexer(markdown).map(tokenToText).join(" ").replace(/\s+/g, " ").trim()
