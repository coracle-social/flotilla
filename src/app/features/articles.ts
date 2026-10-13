const WORDS_PER_MINUTE = 200

// Articles are markdown, so this counts syntax as words too.
export const displayReadingTime = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return `${minutes} minute${minutes === 1 ? "" : "s"}`
}
