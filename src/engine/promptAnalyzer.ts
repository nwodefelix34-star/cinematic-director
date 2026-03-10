export interface ShotResult {
  id: string
  prompt: string
}

export function analyzeStockPrompt(query: string): ShotResult[] {

  if (!query) return []

  const MAX_SHOTS = 4

  const cleaned = query
    .replace(/\./g, ",")
    .replace(/ and /gi, ",")
    .replace(/ with /gi, ",")
    .replace(/ then /gi, ",")
    .replace(/ while /gi, ",")
    .replace(/ as /gi, ",")
    .replace(/ showing /gi, ",")
    .replace(/ where /gi, ",")

  let parts = cleaned
    .split(",")
    .map(p => p.trim())
    .filter(p => p.length > 3)

  // If still only one part, force cinematic breakdown
  if (parts.length <= 1) {

    const words = query.split(" ")

    const segmentSize = Math.ceil(words.length / 3)

    parts = [
      words.slice(0, segmentSize).join(" "),
      words.slice(segmentSize, segmentSize * 2).join(" "),
      words.slice(segmentSize * 2).join(" ")
    ].filter(p => p.length > 3)

  }

  const elements = parts.slice(0, MAX_SHOTS)

  return elements.map((el, index) => ({
    id: "shot-" + index + "-" + Date.now(),
    prompt: el
  }))
}
