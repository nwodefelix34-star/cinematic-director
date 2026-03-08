import { generateImage, generateVideo } from "../services/geminiService"

const PIXABAY_KEY = import.meta.env.VITE_PIXABAY_API_KEY
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_API_KEY


// ===============================
// AI IMAGE
// ===============================

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


// ===============================
// AI VIDEO
// ===============================

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


// ===============================
// PIXABAY SEARCH
// ===============================

async function searchPixabay(query: string) {

  if (!PIXABAY_KEY) {
    console.warn("Pixabay key missing")
    return []
  }

  const url =
    `https://pixabay.com/api/?key=${PIXABAY_KEY}` +
    `&q=${encodeURIComponent(query)}` +
    `&image_type=photo` +
    `&per_page=5`

  const res = await fetch(url)
  const data = await res.json()

  if (!data.hits) return []

  return data.hits.map((img: any) => ({
    url: img.webformatURL,
    source: "pixabay"
  }))
}


// ===============================
// UNSPLASH SEARCH
// ===============================

async function searchUnsplash(query: string) {

  if (!UNSPLASH_KEY) {
    console.warn("Unsplash key missing")
    return []
  }

  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_KEY}`
    }
  })

  const data = await res.json()

  if (!data.results) return []

  return data.results.map((img: any) => ({
    url: img.urls.regular,
    source: "unsplash"
  }))
}


// ===============================
// STOCK ENGINE
// ===============================

export async function fetchStockImages(query: string) {

  const [pixabay, unsplash] = await Promise.all([
    searchPixabay(query),
    searchUnsplash(query)
  ])

  const combined = [...pixabay, ...unsplash]

  return combined
}
