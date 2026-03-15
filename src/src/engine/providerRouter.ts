import { generateImage as geminiImage, generateVideo as geminiVideo } from "../services/geminiService"

export type ImageProvider =
  | "gemini"
  | "flux"
  | "nanobanana"
  | "imagefx"

export type VideoProvider =
  | "veo"
  | "runway"
  | "kling"
  | "grok"



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
      return geminiImage(prompt, aspectRatio, context, style)

    case "flux":
      throw new Error("Flux provider not implemented")

    case "nanobanana":
      throw new Error("NanoBanana bridge not implemented")

    case "imagefx":
      throw new Error("ImageFX bridge not implemented")

    default:
      throw new Error("Unknown image provider")

  }
}



// ===============================
// VIDEO ROUTER
// ===============================

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

    case "veo":
      return geminiVideo(
        prompt,
        startImage,
        aspectRatio,
        style,
        context,
        resolution
      )

    case "runway":
      throw new Error("Runway not implemented")

    case "kling":
      throw new Error("Kling bridge not implemented")

    case "grok":
      throw new Error("Grok video not implemented")

    default:
      throw new Error("Unknown video provider")

  }

}
