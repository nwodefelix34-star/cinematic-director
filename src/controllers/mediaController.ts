import { Project, Scene, ProjectStatus } from "../types"
import { buildImage, fetchStockImages } from "../engine/mediaEngine"
import { analyzeStockPrompt } from "../engine/promptAnalyzer"
import { planCinematicShots } from "../engine/shotPlanner"
import { buildPrompt } from "../engine/promptBuilder"

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

  const detailedPrompt = buildPrompt(scene, project)
const shots = planCinematicShots(detailedPrompt)

  const clips = []
  let clipIndex = 0

  for (const shot of shots) {

    const frames = []
let frameIndex = 0

for (const framePrompt of shot.frames) {

  let imageUrl = null

  if (frameIndex === 0 && scene.referenceFrameUrl) {
    imageUrl = scene.referenceFrameUrl
  } else {

    imageUrl = await buildImage(
      framePrompt,
      project.aspectRatio as any,
      project.globalContext,
      project.visualStyle
    )

  }

  if (!scene.referenceFrameUrl && frameIndex === 0) {
    scene.referenceFrameUrl = imageUrl
  }

  frames.push({
    id: "frame-" + Date.now() + "-" + frameIndex,
    index: frameIndex,
    prompt: framePrompt,
    imageUrl: imageUrl,
    duration: project.sceneDuration / shots.length / shot.frames.length,
    type: "ai"
  })

  frameIndex++

}

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

if (!scene.clips || scene.clips.length === 0) return null

const updatedFrames = []

for (const clip of scene.clips) {

  if (!clip.frames || clip.frames.length < 2) continue

  const startFrame = clip.frames[0]
  const targetFrame = clip.frames[clip.frames.length - 1]

  const motionPrompt =
    scene.videoPrompt ||
    `${startFrame.prompt}, cinematic motion evolving into ${targetFrame.prompt}, natural movement, smooth camera motion`

  const url = await generateVideo(
    motionPrompt,
    startFrame.imageUrl,
    targetFrame.imageUrl,
    project.aspectRatio,
    project.visualStyle,
    project.globalContext,
    project.resolution
  )

  const updatedClipFrames = clip.frames.map(frame =>
    frame.id === targetFrame.id
      ? { ...frame, videoUrl: url }
      : frame
  )

  updatedFrames.push(...updatedClipFrames)

}

return {
  frames: updatedFrames
}
}
