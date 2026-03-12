import { Project, Scene, ProjectStatus } from "../types"
import { buildImage, fetchStockImages } from "../engine/mediaEngine"
import { analyzeStockPrompt } from "../engine/promptAnalyzer"
import { planCinematicShots } from "../engine/shotPlanner"

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
  index: frames.length,
  prompt: shot.prompt,
  imageUrl: options[0],
  options: options,
  duration: scene.duration || project.sceneDuration,
  type: "stock"
})

      }
    }

    const clips = frames.map((frame, i) => ({
  id: "clip-" + Date.now() + "-" + i,
  index: i,
  frames: [frame],
  duration: frame.duration
}))

return { frames, clips }

  }

  // AI MODE

if (imageProvider === "gemini") {

  const shots = planCinematicShots(activePrompt)

  const clips = []
  let clipIndex = 0

  for (const shot of shots) {

    const startPrompt = `${shot.prompt}, beginning of action`
    const targetPrompt = `${shot.prompt}, end of action`

    const startImage = await buildImage(
      startPrompt,
      project.aspectRatio as any,
      project.globalContext,
      project.visualStyle
    )

    const targetImage = await buildImage(
      targetPrompt,
      project.aspectRatio as any,
      project.globalContext,
      project.visualStyle
    )

    const frames = [

      {
        id: "frame-" + Date.now() + "-a",
        index: 0,
        prompt: startPrompt,
        imageUrl: startImage,
        duration: project.sceneDuration / shots.length / 2,
        type: "ai"
      },

      {
        id: "frame-" + Date.now() + "-b",
        index: 1,
        prompt: targetPrompt,
        imageUrl: targetImage,
        duration: project.sceneDuration / shots.length / 2,
        type: "ai"
      }

    ]

    clips.push({
      id: "clip-" + Date.now() + "-" + clipIndex,
      index: clipIndex,
      frames: frames,
      duration: project.sceneDuration / shots.length
    })

    clipIndex++
  }

  const frames = clips.flatMap(c => c.frames)

  return { frames, clips }
    }

  throw new Error("Image provider not implemented")
}

export async function generateSceneVideo(
  scene: Scene,
  project: Project,
  generateVideo: any
) {

if (!scene.frames || scene.frames.length === 0) return null

const lastFrame = scene.frames[scene.frames.length - 1]

if (!lastFrame.imageUrl) return null

const startFrame = scene.frames[0]
const targetFrame = scene.frames[scene.frames.length - 1]

const motionPrompt =
  scene.videoPrompt ||
  `${startFrame.prompt} transitioning into ${targetFrame.prompt}, cinematic motion`

const url = await generateVideo(
  motionPrompt,
  startFrame.imageUrl,
  project.aspectRatio,
  project.visualStyle,
  project.globalContext,
  project.resolution
)
const updatedFrames = scene.frames.map(frame =>
frame.id === lastFrame.id
? { ...frame, videoUrl: url }
: frame
)

return {
frames: updatedFrames
}
}
