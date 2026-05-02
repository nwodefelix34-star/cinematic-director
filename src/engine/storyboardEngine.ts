import {
  generateStoryboard,
  generateFutureLifeStory,
  generateKnowIt
} from "../services/geminiService";

// ── buildStoryboard — unchanged, all other channels ──
export async function buildStoryboard(
  topic: string,
  channelId: string,
  isVertical: boolean,
  numScenes: number
) {
  return await generateStoryboard(topic, channelId, isVertical, numScenes);
}

// ── buildFutureLifeStoryboard — unchanged ──
export async function buildFutureLifeStoryboard(
  topic: string,
  isVertical: boolean,
  numScenes: number
) {
  return await generateFutureLifeStory(topic, numScenes);
}

// ═══════════════════════════════════════════════════════════
// buildKnowItStoryboard — UPDATED
//
// WHY: The old version just passed everything through from
// generateKnowIt unchanged. The new generateKnowIt now returns
// shotType and scaleLabel per scene — but the raw API response
// uses "prompt" not "aiPrompt", and the scene structure needs
// to be normalized before App.tsx maps it into Scene objects.
//
// WHAT THIS DOES:
// 1. Calls generateKnowIt with only topic + isVertical
//    (numScenes removed — KnowIt always generates exactly 5
//    scenes matching our 5-section structure. Passing numScenes
//    would let Gemini deviate from the Hook/Reveal/Body/Fix/CTA
//    structure we enforced.)
//
// 2. Normalizes each scene so the returned object always has:
//    - aiPrompt (renamed from prompt if needed)
//    - narration
//    - sfx
//    - shotTypeHint (from shotType field Gemini returns)
//    - scaleLabel (from scaleLabel field Gemini returns)
//
// 3. Returns the full result so App.tsx handleKnowItStoryboard
//    can map it into Scene[] with shotTypeHint preserved.
// ═══════════════════════════════════════════════════════════

export async function buildKnowItStoryboard(
  topic: string,
  isVertical: boolean,
  _numScenes: number // ignored for KnowIt — always 5 sections
) {
  const result = await generateKnowIt(topic, isVertical);

  // Normalize scenes — Gemini returns "prompt" but our Scene
  // type uses "aiPrompt". We also pull shotType → shotTypeHint
  // so App.tsx can store it directly on the Scene object.
  const normalizedScenes = result.scenes.map((s: any) => ({
    // aiPrompt: use prompt field if aiPrompt not present
    aiPrompt: s.aiPrompt || s.prompt || '',
    narration: s.narration || s.narrationChunk || '',
    sfx: s.sfx || '',
    // ── shotTypeHint: tells promptBuilder which character state ──
    shotTypeHint: s.shotType || s.shotTypeHint || 'type-a',
    // ── scaleLabel: EXTERNAL / ORGAN / CELLULAR for body section ──
    scaleLabel: s.scaleLabel || ''
  }));

  return {
    ...result,
    scenes: normalizedScenes
  };
}
