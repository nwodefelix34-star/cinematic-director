import { Project, Scene, ProjectStatus } from "../types"
import { buildImage, fetchStockImages } from "../engine/mediaEngine"
import { analyzeStockPrompt } from "../engine/promptAnalyzer"

export async function generateSceneImage(
  scene: Scene,
  project: Project,
  mediaMode: "ai" | "stock",
  imageProvider: "gemini" | "flow" | "wix"
) {

  if (!scene) return null

  const activePrompt =
    mediaMode === "stock"
      ? scene.stockQuery
      : scene.aiPrompt

  if (!activePrompt || activePrompt.trim() === "") {
    throw new Error("Prompt is empty")
  }

  // STOCK MODE
  if (mediaMode === "stock") {

    const shots = analyzeStockPrompt(scene.stockQuery || "")
    const frames = []

    for (const shot of shots) {

      const images = await fetchStockImages(shot.prompt)

      if (images && images.length > 0) {

        const options = images.map(img => img.url)

        frames.push({
          id: "frame-" + Date.now() + Math.random(),
          prompt: shot.prompt,
          imageUrl: options[0],
          options: options,
          duration: scene.duration || project.sceneDuration,
          type: "stock"
        })

      }
    }

    return { frames }

  }

  // AI MODE

  if (imageProvider === "gemini") {

    const imageUrl = await buildImage(
      activePrompt,
      project.aspectRatio as any,
      project.globalContext,
      project.visualStyle
    )

    return {
      frames: [{
        id: "frame-" + Date.now(),
        prompt: activePrompt,
        imageUrl: imageUrl,
        duration: project.sceneDuration,
        type: "ai"
      }]
    }

  }

  throw new Error("Image provider not implemented")
}
