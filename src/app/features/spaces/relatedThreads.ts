import type {TrustedEvent} from "@welshman/util"
import {THREAD} from "@welshman/util"
import {Thread} from "@welshman/domain"
import {reader} from "@app/core/domain"
import {makeFeed} from "@app/features/feeds"

// Words that carry no topic on their own, so they never separate one thread from another.
const STOPWORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "can't",
  "cannot",
  "could",
  "couldn't",
  "did",
  "didn't",
  "do",
  "does",
  "doesn't",
  "doing",
  "don't",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadn't",
  "has",
  "hasn't",
  "have",
  "haven't",
  "having",
  "he",
  "he'd",
  "he'll",
  "he's",
  "her",
  "here",
  "here's",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "how's",
  "i",
  "i'd",
  "i'll",
  "i'm",
  "i've",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "it's",
  "its",
  "itself",
  "just",
  "me",
  "might",
  "more",
  "most",
  "mustn't",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "one",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "shan't",
  "she",
  "she'd",
  "she'll",
  "she's",
  "should",
  "shouldn't",
  "so",
  "some",
  "such",
  "than",
  "that",
  "that's",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "there's",
  "these",
  "they",
  "they'd",
  "they'll",
  "they're",
  "they've",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "wasn't",
  "we",
  "we'd",
  "we'll",
  "we're",
  "we've",
  "were",
  "weren't",
  "what",
  "what's",
  "when",
  "when's",
  "where",
  "where's",
  "which",
  "while",
  "who",
  "who's",
  "whom",
  "why",
  "why's",
  "with",
  "won't",
  "would",
  "wouldn't",
  "you",
  "you'd",
  "you'll",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
])

// Drops short and common words, returning the rest as a multiset of counts.
export const tokenize = (text: string) => {
  const counts = new Map<string, number>()
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

  for (const word of words) {
    if (word.length >= 3 && !STOPWORDS.has(word)) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return counts
}

// A thread's title repeats its topic, so its words weigh twice those of the body.
export const threadTokens = (event: TrustedEvent) => {
  const title = reader(Thread)(event).title() ?? ""
  const body = event.content ?? ""
  const counts = new Map<string, number>()

  const count = (words: Map<string, number>, weight: number) => {
    for (const [word, n] of words) {
      counts.set(word, (counts.get(word) ?? 0) + n * weight)
    }
  }

  count(tokenize(title), 2)
  count(tokenize(body), 1)

  return counts
}

// Inverse document frequency: a term shared by only a few of the space's
// threads signals they belong together, so it weighs more than one nearly
// every thread uses. Computed per ranking from the candidate term counts,
// smoothed so a term every thread shares keeps a small weight instead of zero.
const inverseDocumentFrequency = (total: number, docs: number) =>
  Math.log((total + 1) / (docs + 1)) + 1

// Scales a term-count map by how rare each term is across the candidate set,
// leaving out the terms no candidate holds, which cannot match anyway.
const weighIDF = (counts: Map<string, number>, idf: Map<string, number>) => {
  const scaled = new Map<string, number>()

  for (const [word, n] of counts) {
    const w = idf.get(word)

    if (w) {
      scaled.set(word, n * w)
    }
  }

  return scaled
}

// Cosine over the two weighted term counts, 0 when either side has no tokens.
export const cosine = (a: Map<string, number>, b: Map<string, number>) => {
  let dot = 0
  let aa = 0
  let bb = 0

  for (const n of a.values()) {
    aa += n * n
  }
  for (const n of b.values()) {
    bb += n * n
  }

  if (aa === 0 || bb === 0) {
    return 0
  }

  for (const [word, n] of a) {
    const m = b.get(word)

    if (m) {
      dot += n * m
    }
  }

  return dot / Math.sqrt(aa * bb)
}

// How close another thread has to be to deserve a place, kept low so a real suggestion can surface.
export const MIN_SCORE = 0.06

export const MAX_RELATED = 3

// A store of a space's thread roots, shared by the thread page and the composer so
// both rank the same candidates without each fetching its own copy.
export const loadSpaceThreads = (url: string) =>
  makeFeed({relays: [url], filters: [{kinds: [THREAD]}]})

// Ranks candidate threads by how many rare topic words they share with a
// query's counts: IDF makes a term two threads alone share outweigh one
// everyone uses, so proper nouns and specific subjects surface.
export const rankThreads = ({
  query,
  candidates,
  exclude,
}: {
  query: Map<string, number>
  candidates: TrustedEvent[]
  exclude?: string
}) => {
  // Pair each candidate with its own term counts, dropping the query's thread.
  const pairs = candidates
    .filter(event => event.id !== exclude)
    .map(event => ({event, doc: threadTokens(event)}))
    .filter(({doc}) => doc.size > 0)

  // How many of the space's other threads hold each word, for its IDF weight.
  const df = new Map<string, number>()

  for (const {doc} of pairs) {
    for (const word of doc.keys()) {
      df.set(word, (df.get(word) ?? 0) + 1)
    }
  }

  const total = Math.max(pairs.length, 1)
  const idf = new Map<string, number>()

  for (const [word, count] of df) {
    idf.set(word, inverseDocumentFrequency(total, count))
  }

  const queryWeighted = weighIDF(query, idf)

  return pairs
    .map(({event, doc}) => ({event, score: cosine(queryWeighted, weighIDF(doc, idf))}))
    .filter(({score}) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RELATED)
    .map(({event}) => event)
}
