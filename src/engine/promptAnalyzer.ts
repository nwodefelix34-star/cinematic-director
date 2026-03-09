export interface ShotResult {
  id: string
  prompt: string
}

export function analyzeStockPrompt(query: string): ShotResult[] {

  if (!query) return []

  // Normalize text
  const cleaned = query
    .toLowerCase()
    .replace(/\band\b/gi, ",")
    .replace(/\bwith\b/gi, ",")
    .replace(/\bon\b/gi, ",")
    .replace(/\bat\b/gi, ",")
    .replace(/\bin\b/gi, ",")
    .replace(/\bnear\b/gi, ",")

  // First attempt: split by commas
  let parts = cleaned
    .split(",")
    .map(p => p.trim())
    .filter(p => p.length > 3)

  // If still only one element, split by descriptive chunks
  if (parts.length <= 1) {

    const words = cleaned.split(" ")

    const chunks: string[] = []

    for (let i = 0; i < words.length; i += 2) {
      const chunk = words.slice(i, i + 2).join(" ")
      if (chunk.length > 3) {
        chunks.push(chunk)
      }
    }

    parts = chunks
  }

  const MAX_SHOTS = 4
  const elements = parts.slice(0, MAX_SHOTS)

  return elements.map((el, index) => ({
    id: "shot-" + index + "-" + Date.now(),
    prompt: el
  }))
}
