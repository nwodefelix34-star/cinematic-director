import { generateImage, generateVideo } from "../services/geminiService"

const PIXABAY_KEY = import.meta.env.VITE_PIXABAY_KEY

// ---------------- AI IMAGE ----------------

export async function buildImage(
  prompt: string,
  aspectRatio: '9:16' | '16:9',
  context: string,
  style: string
) {
  return await generateImage(
    prompt,
    aspectRatio,
    context,
    style
  )
}

// ---------------- AI VIDEO ----------------

export async function buildVideo(
  prompt: string,
  imageUrl: string,
  aspectRatio: '9:16' | '16:9',
  style: string,
  context: string,
  resolution: string
) {
  return await generateVideo(
    prompt,
    imageUrl,
    aspectRatio,
    style,
    context,
    resolution
  )
}

// ---------------- STOCK IMAGE ----------------

export async function fetchStockImage(query: string) {

  if (!PIXABAY_KEY) {
    console.error("Pixabay API key missing")
    return ""
  }

  const url =
    `https://pixabay.com/api/?key=${PIXABAY_KEY}` +
    `&q=${encodeURIComponent(query)}` +
    `&image_type=photo&orientation=horizontal&per_page=3`

  const res = await fetch(url)

  const data = await res.json()

  if (!data.hits || data.hits.length === 0) {
    return ""
  }

  return data.hits[0].webformatURL
}
