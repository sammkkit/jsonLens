/**
 * Subsequence match with light scoring: consecutive characters and matches at
 * word boundaries rank higher, which is what makes "fj" find "Format JSON".
 * Returns -1 when the query doesn't match at all.
 */
export function fuzzyScore(query: string, text: string): number {
  if (query === '') return 0
  const needle = query.toLowerCase()
  const haystack = text.toLowerCase()

  let score = 0
  let cursor = 0
  let previousIndex = -2

  for (const character of needle) {
    if (character === ' ') continue
    const index = haystack.indexOf(character, cursor)
    if (index === -1) return -1
    if (index === previousIndex + 1) score += 6
    if (index === 0 || /[\s.\-_/]/.test(haystack[index - 1])) score += 4
    score += Math.max(0, 4 - index + cursor)
    previousIndex = index
    cursor = index + 1
  }
  // Prefer tighter matches over long titles that happen to contain the letters.
  return score - Math.floor(text.length / 12)
}
