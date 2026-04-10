/**
 * GitHub-style heading slugs: duplicate titles get `-1`, `-2`, …
 */
export function createSlugger() {
  const counts = new Map<string, number>()

  return {
    slug(text: string): string {
      let base = text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}-]/gu, '')
      if (!base) base = 'section'

      const n = counts.get(base) ?? 0
      counts.set(base, n + 1)
      return n === 0 ? base : `${base}-${n}`
    },
  }
}
