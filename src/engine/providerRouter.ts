
// ── generateVideo removed from import — Veo is replaced by Hunyuan Bridge ──
// generateImage signature changed — now takes Scene + Project objects
// For the router we keep a simpler direct call path for non-KnowIt channels
import { generateImage as geminiImage } from "../services/geminiService"

export type ImageProvider =
  | "gemini"
  | "flow"
  | "wix"
  | "flux"
  | "nanobanana"
  | "imagefx"

export type VideoProvider =
  | "hunyuan"  // bridge only — handled in App.tsx
  | "runway"   // coming soon
  | "kling"    // coming soon
  | "veo"      // removed — was paid Gemini API

// ===============================
// IMAGE ROUTER
// ===============================

export async function generateImageRouter(
  provider: ImageProvider,
  prompt: string,
  aspectRatio: string,
  context: string,
  style: string
) {
  switch (provider) {

    case "gemini":
      // For non-KnowIt channels — pass prompt directly
      // KnowIt routing is handled in mediaController before this is called
      return geminiImage(
        { aiPrompt: prompt } as any,
        { globalContext: context, visualStyle: style, aspectRatio } as any,
        "type-a"
      )

    case "flow":
      throw new Error("Flow bridge is handled in the app UI — not an API call")

    case "wix":
      throw new Error("Wix bridge is handled in the app UI — not an API call")

    case "flux":
      throw new Error("Flux provider not yet connected")

    case "nanobanana":
      throw new Error("NanoBanana bridge not yet connected")

    case "imagefx":
      throw new Error("ImageFX bridge is handled in the app UI — not an API call")

    default:
      throw new Error("Unknown image provider")
  }
}

// ===============================
// VIDEO ROUTER
// ===============================
// Veo removed — it required paid Gemini API access.
// KnowIt3D video generation uses the Hunyuan Bridge in App.tsx.
// Other providers are placeholders for future wiring.

export async function generateVideoRouter(
  provider: VideoProvider,
  prompt: string,
  startImage: string,
  aspectRatio: '16:9' | '9:16',
  style: string,
  context: string,
  resolution: '720p' | '1080p'
) {
  switch (provider) {

    case "hunyuan":
      throw new Error("Hunyuan is a manual bridge — use the Hunyuan Bridge panel in the app")

    case "runway":
      throw new Error("Runway not yet connected")

    case "kling":
      throw new Error("Kling not yet connected")

    case "veo":
      throw new Error("Veo has been removed — use Hunyuan Bridge instead")

    default:
      throw new Error("Unknown video provider")
  }
}
