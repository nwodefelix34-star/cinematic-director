import { Project, Scene } from "../types"
import { buildImage } from "../engine/mediaEngine"
// ── fetchStockImages kept for non-KnowIt stock channels ──
import { fetchStockImages } from "../engine/mediaEngine"
import { analyzeStockPrompt } from "../engine/promptAnalyzer"
import { planCinematicShots } from "../engine/shotPlanner"
import { buildPrompt } from "../engine/promptBuilder"
import { generateImage } from "../services/geminiService"

// ═══════════════════════════════════════════════════════════
// WHAT CHANGED AND WHY
//
// OLD PROBLEMS:
// 1. imageProvider "imagefx" threw: "Image provider not implemented"
//    This is what was breaking image generation entirely.
//
// 2. imageProvider "flow" and "wix" also threw the same error.
//    These were UI options that had no backend.
//
// 3. Stock mode was available for all channels including KnowIt.
//    KnowIt should never use stock — it's AI only.
//
// 4. The Gemini path called buildPrompt() then planCinematicShots()
//    then looped through multiple shots and frames per scene.
//    For KnowIt this is wrong — we generate ONE image per scene,
//    not a multi-shot cinematic sequence.
//
// NEW ROUTING:
//
// KnowIt channel (project.channelId === 'knowit'):
//   → Always uses generateImage(scene, project, shotTypeHint)
//   → This calls our full promptBuilder with 4-state character system
//   → Returns one frame per scene — simple and fast
//   → Stock mode blocked
//   → flow/wix/imagefx bridge providers: return null
//     (the bridge is handled in App.tsx before this is called,
//      so this path is only reached for Gemini fallback)
//
// All other channels:
//   → Stock mode: unchanged — uses fetchStockImages
//   → Gemini AI mode: unchanged — uses buildPrompt + planCinematicShots
//   → flow/wix/imagefx: throw clear error so devs know to wire them
// ═══════════════════════════════════════════════════════════

export async function generateSceneImage(
  scene: Scene,
  project: Project,
  mediaMode: "ai" | "stock",
  imageProvider: "gemini" | "flow" | "wix" | "flux" | "nanobanana" | "imagefx"
) {
  if (!scene) return null

  const isKnowIt = project.channelId === 'knowit'

  // ── KnowIt3D: always AI, always single image via Gemini ──
  if (isKnowIt) {
    if (mediaMode === 'stock') {
      throw new Error("KnowIt3D does not use stock images. Switch to AI mode.")
    }

    // flow/wix/imagefx for KnowIt are handled by the Flow Bridge
    // in App.tsx before this function is called.
    // If we somehow reach here with those providers, return null
    // so the UI shows nothing broke — the bridge handles it.
    if (imageProvider === 'flow' || imageProvider === 'wix' || imageProvider === 'imagefx') {
      return null
    }

    // Gemini fallback for KnowIt — uses our full character prompt system
    const shotType = (scene as any).shotTypeHint || 'type-a'
    const imageUrl = await generateImage(scene, project, shotType)

    const frame = {
      id: crypto.randomUUID(),
      index: 0,
      prompt: scene.aiPrompt || '',
      imageUrl: imageUrl,
      options: [imageUrl],
      duration: scene.duration || project.sceneDuration,
      type: 'ai' as const
    }

    const clip = {
      id: 'clip-' + Date.now(),
      index: 0,
      frames: [frame],
      duration: scene.duration || project.sceneDuration
    }

    return { frames: [frame], clips: [clip] }
  }

  // ── All other channels — original logic below ──

  const activePrompt = mediaMode === "stock" ? scene.stockQuery : scene.aiPrompt

  if (!activePrompt || activePrompt.trim() === "") {
    throw new Error("Prompt is empty")
  }

  // STOCK MODE — unchanged
  if (mediaMode === "stock") {
    const shots = analyzeStockPrompt(scene.stockQuery || "")
    const frames = []

    for (const shot of shots) {
      const images = await fetchStockImages(shot.prompt)

      if (images && images.length > 0) {
        const options = images.map((img: any) => img.url)
        frames.push({
          id: crypto.randomUUID(),
          index: frames.length,
          prompt: shot.prompt,
          imageUrl: options[0],
          options: options,
          duration: scene.duration || project.sceneDuration,
          type: "stock" as const
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

  // AI MODE — Gemini, original cinematic shot planner
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

          // Character identity capture
          if (scene.characterIds && scene.characterIds.length > 0) {
            const mainCharacterId = scene.characterIds[0]
            const character = project.characters?.find(c => c.id === mainCharacterId)
            if (character && !character.referenceImage) {
              character.referenceImage = imageUrl
            }
          }
        }

        if (!scene.referenceFrameUrl && frameIndex === 0) {
          scene.referenceFrameUrl = imageUrl
        }

        frames.push({
          id: crypto.randomUUID(),
          index: frameIndex,
          prompt: framePrompt,
          imageUrl: imageUrl,
          duration: project.sceneDuration / shots.length / shot.frames.length,
          type: "ai" as const
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

  // ── flow/wix/imagefx for non-KnowIt channels ──
  // These are placeholders — wire them when APIs become available
  if (imageProvider === 'flow' || imageProvider === 'wix' || imageProvider === 'imagefx') {
    throw new Error(`${imageProvider} provider is not yet connected. Use Gemini for now.`)
  }

  throw new Error("Unknown image provider: " + imageProvider)
}

// ═══════════════════════════════════════════════════════════
// generateSceneVideo — unchanged
// KnowIt uses Hunyuan Bridge (handled in App.tsx).
// This function is only called for other channels.
// ═══════════════════════════════════════════════════════════

export async function generateSceneVideo(
  scene: Scene,
  project: Project,
  generateVideo: any
) {
  if (!scene.clips || scene.clips.length === 0) return null

  const updatedFrames = []

  for (const clip of scene.clips) {
    if (!clip.frames || clip.frames.length < 2) continue

    const startFrame = clip.frames[0]
    const targetFrame = clip.frames[clip.frames.length - 1]

    const motionPrompt =
      scene.videoPrompt ||
      `${startFrame.prompt}, cinematic motion evolving into ${targetFrame.prompt}, natural movement, smooth camera motion`

    if (!startFrame.imageUrl || !targetFrame.imageUrl) continue

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
      frame.id === targetFrame.id ? { ...frame, videoUrl: url } : frame
    )

    updatedFrames.push(...updatedClipFrames)
  }

  return { frames: updatedFrames, clips: scene.clips }
}
