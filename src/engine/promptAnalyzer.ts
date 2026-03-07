export interface ShotResult {
  id: string
  prompt: string
}

export function analyzeStockPrompt(query: string): ShotResult[] {

  if (!query) return []

  // Normalize text
  const cleaned = query
    .replace(/\band\b/gi, ",")
    .replace(/\bwith\b/gi, ",")
    .replace(/\bon\b/gi, ",")
    .replace(/\bat\b/gi, ",")

  // Split potential visual elements
  const parts = cleaned
    .split(",")
    .map(p => p.trim())
    .filter(p => p.length > 3)

  // Limit number of shots
  const MAX_SHOTS = 4

  const elements = parts.slice(0, MAX_SHOTS)

  return elements.map((el, index) => ({
    id: "shot-" + index + "-" + Date.now(),
    prompt: el
  }))
}
