import {inc, sortBy, take} from "@welshman/lib"

type Weights = Map<string, number>

export type SimilarityIndex<T> = {
  docs: {item: T; weights: Weights}[]
  idf: Weights
}

const STOPWORDS = new Set(
  `
  about above after again against all also am an and any are aren't as at be because been
  before being below between both but by can can't cannot could couldn't did didn't do does
  doesn't doing don't down during each few for from further had hadn't has hasn't have haven't
  having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll
  i'm i've if in into is isn't it it's its itself just me might more most mustn't my myself no
  nor not now of off on once one only or other ought our ours ourselves out over own same
  shan't she she'd she'll she's should shouldn't so some such than that that's the their
  theirs them themselves then there there's these they they'd they'll they're they've this
  those through to too under until up very was wasn't we we'd we'll we're we've were weren't
  what what's when when's where where's which while who who's whom why why's with won't would
  wouldn't you you'd you'll you're you've your yours yourself yourselves
  `
    .trim()
    .split(/\s+/),
)

const tokenize = (text: string) => {
  const counts: Weights = new Map()

  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (word.length >= 3 && !STOPWORDS.has(word)) {
      counts.set(word, inc(counts.get(word)))
    }
  }

  return counts
}

const weigh = (counts: Weights, idf: Weights) => {
  const weights: Weights = new Map()

  for (const [word, n] of counts) {
    const w = idf.get(word)

    if (w) {
      weights.set(word, n * w)
    }
  }

  return weights
}

const cosine = (a: Weights, b: Weights) => {
  let dot = 0
  let aa = 0
  let bb = 0

  for (const [word, n] of a) {
    aa += n * n
    dot += n * (b.get(word) ?? 0)
  }

  for (const n of b.values()) {
    bb += n * n
  }

  return aa && bb ? dot / Math.sqrt(aa * bb) : 0
}

export const indexDocuments = <T>(items: T[], getText: (item: T) => string): SimilarityIndex<T> => {
  const counted = items.map(item => ({item, counts: tokenize(getText(item))}))
  const df: Weights = new Map()

  for (const {counts} of counted) {
    for (const word of counts.keys()) {
      df.set(word, inc(df.get(word)))
    }
  }

  // Smoothed so a word every document shares still keeps a little weight.
  const idf: Weights = new Map()

  for (const [word, n] of df) {
    idf.set(word, Math.log((counted.length + 1) / (n + 1)) + 1)
  }

  const docs = counted.map(({item, counts}) => ({item, weights: weigh(counts, idf)}))

  return {docs, idf}
}

// The threshold is kept low so a real match can surface among only a few documents.
export const rankDocuments = <T>({docs, idf}: SimilarityIndex<T>, text: string) => {
  const query = weigh(tokenize(text), idf)
  const scored = docs
    .map(({item, weights}) => ({item, score: cosine(query, weights)}))
    .filter(({score}) => score >= 0.06)

  return take(
    3,
    sortBy(({score}) => -score, scored),
  ).map(({item}) => item)
}
