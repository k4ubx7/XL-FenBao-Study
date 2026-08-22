const URL_CANDIDATE = /https?:\/\/[^\s<>"'`，。！？、；：（）【】《》]+/giu
const TRAILING_PUNCTUATION = /[，。！？、；：,;.!?）)\]】}》〉]+$/u

export function extractUrls(text: string): string[] {
  const results: string[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(URL_CANDIDATE)) {
    const candidate = match[0].replace(TRAILING_PUNCTUATION, '')

    try {
      const parsed = new URL(candidate)
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !seen.has(candidate)
      ) {
        seen.add(candidate)
        results.push(candidate)
      }
    } catch {
      // Ignore incomplete or malformed URL-like text.
    }
  }

  return results
}
