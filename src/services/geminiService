
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Scene, Project } from "../types";
import { buildPrompt } from "../engine/promptBuilder";

// ═══════════════════════════════════════════════════════════
// WHAT CHANGED AND WHY — READ THIS FIRST
//
// REMOVED:
// 1. generateVideo (Veo 3.1) — Veo is expensive and not free.
//    Replaced by the Hunyuan Bridge system in the UI.
//    The bridge opens aistudio.tencent.com and passes the prompt.
//
// 2. stockQuery from generateKnowIt — KnowIt3D is AI only.
//    Stock images are gone from this channel entirely.
//
// 3. The old generic KnowIt prompt — it was just "Zachdfilms style,
//    give me 5 scenes." Had no knowledge of our 5-section structure,
//    90-word budget, gender detection, or 3-scale body system.
//
// REWRITTEN:
// 4. generateKnowIt — completely rebuilt using everything we
//    developed: 5-section script (Hook/Reveal/Body/Fix/CTA),
//    90-word budget, escalating 3-scale body sentences,
//    gender detection from title, and 28-shot scene structure.
//
// 5. generateImage — now calls buildPrompt from promptBuilder.ts
//    instead of building its own raw prompt. For KnowIt channel
//    this means our full 4-state character system is used.
//    For all other channels nothing changes.
//
// KEPT EXACTLY THE SAME:
// - generateIdeas (all channels)
// - generateStoryboard (all channels except KnowIt)
// - generateFutureLifeStory
// - generateNarration
// - enhancePrompt
// - generateCustomStyle
// - decodeBase64 / decodeAudioData
// ═══════════════════════════════════════════════════════════

const getAI = () =>
  new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

const UNIVERSAL_HOOK_RULE = `
FIRST SENTENCE RULE:
- The first sentence must immediately create tension.
- No greetings.
- No slow introduction.
- No general statements.
- No "Have you ever".
- No explaining context first.
- Start with a strong, direct, destabilizing line.
- The viewer must feel pulled in instantly.
`;

// ═══════════════════════════════════════════════════════════
// CHANNEL VIRAL STYLES — unchanged for all other channels
// ═══════════════════════════════════════════════════════════

const CHANNEL_VIRAL_STYLES: Record<string, string> = {
  mindforged: `
  CHANNEL LAW (STRICT):
  TITLE STRUCTURE:
- Present a psychological tension.
- Do NOT explain the cause.
- Hint at a hidden mechanism.
- Leave the explanation incomplete.
- Calm but unsettling tone.
- Maximum 9 words.
- Simple everyday language.
- No full conclusions.
- No "because".
- No finished explanations.

REALITY ANCHOR RULE:
- Titles must refer to real human behavior.
- Avoid poetic metaphors as the main structure.
- Focus on actions, habits, emotions, or mental patterns.
- If the title sounds like a quote page, rewrite it.

CURIOSITY ENFORCEMENT:
- Title must make the viewer ask: "Why?" or "What do you mean?"
- If the title answers the question fully, rewrite it.

STORY STRUCTURE RULE:
Scene 1: Calm confrontation. Quietly challenge the viewer's self-perception.
Scene 2: Reveal a familiar behavior pattern.
Scene 3: Hint at the hidden psychological mechanism.
Scene 4: Expose the cost of staying unconscious.
Final Scene: Deliver a simple but unsettling realization.

HOOK STRUCTURE (Scene 1):
- Direct confrontation.
- Challenge a belief immediately.
- No intro. No setup.

NARRATION RULES:
- Second person ONLY.
- Short sentences.
- No academic words.
- No motivational advice.

PACING: Fast. No filler. No long explanations.
ENDING RULE: End with a powerful identity-shift sentence. Must feel slightly uncomfortable.
LANGUAGE: Simple words only. 12-year-old reading level.
`,

  cosmora: `
CHANNEL DNA:
Core Tone: Cosmic awe. Reality is vast and slightly unsettling.

TITLE STRUCTURE:
- Start with a scale-based statement.
- Must feel large or reality-bending.
- Simple language. No heavy astrophysics jargon.
- Maximum 10 words. Leave a sense of unanswered mystery.

HOOK STRUCTURE (Scene 1):
- Start at massive scale (galaxies, time, universe).
- Immediately destabilize a common belief.

STORY STRUCTURE RULE:
Scene 1: Massive scale reveal.
Scene 2: Introduce a surprising fact.
Scene 3: Expand the scale further.
Scene 4: Hint that what we know is incomplete.
Final Scene: End with a universe-altering realization. Cinematic not classroom.
`,

  veiltheory: `
CHANNEL DNA:
Core Tone: Quiet suspicion. Controlled narrative tension.

TITLE STRUCTURE:
- Must feel like something is "off."
- Avoid dramatic conspiracy wording.
- No all caps. No aggressive accusations.
- Maximum 12 words. Calm but unsettling phrasing.

HOOK STRUCTURE (Scene 1):
- Start with a statement that feels slightly wrong.
- Make the viewer question what they think they know.

STORY STRUCTURE RULE:
Scene 1: Introduce a subtle contradiction.
Scene 2: Present an overlooked detail.
Scene 3: Hint at an alternative explanation.
Scene 4: Increase uncertainty without full exposure.
Final Scene: End with unresolved tension. Do NOT fully explain everything.

Language Rule: Simple words. No dramatic exaggeration. No cliché conspiracy phrases.
`,

  futurelife: `
CHANNEL DNA:
Core Tone: Emotional future regret. Cinematic and immersive.

TITLE STRUCTURE:
- Must start with a future time reference or warning.
- Must feel personal. Maximum 12 words.
- Simple emotional language. No tech jargon.

HOOK STRUCTURE (Scene 1):
- Begin in the future. Immediate regret or warning.
- First-person narration ONLY.

STORY STRUCTURE RULE:
Scene 1: Future regret hook.
Scene 2: Flashback to present-day mistake.
Scene 3: Show ignored warning sign.
Scene 4: Reveal painful future consequence.
Final Scene: Direct emotional message to viewer.

Language Rule: Very simple. Emotional. First person only. No technical AI explanations.
`,

  // ── KnowIt viral style is used only for IDEA GENERATION ──
  // The storyboard/script is handled separately by generateKnowIt below.
  knowit: `
CHANNEL DNA:
Core Tone: Extremely fast. Unexpected. Instant curiosity hit.

TITLE STRUCTURE:
- Maximum 8 words.
- Extremely simple. Clear shocking statement.
- Must feel instantly understandable.
- No filler words. No poetic phrasing.

HOOK STRUCTURE (Scene 1):
- Start with the shocking fact immediately.
- No buildup. No intro.

STORY STRUCTURE RULE:
Scene 1: Drop a surprising fact instantly.
Scene 2: Explain briefly in simple words.
Scene 3: Add a second twist or surprising detail.
Scene 4: Give quick real-world implication.
Final Scene: End clean. No motivation. No reflection. Just impact.

Language Rule: Very simple. 10-year-old reading level. Short sentences. Fast pacing.
`,
};

// ═══════════════════════════════════════════════════════════
// GENERATE IDEAS — unchanged, all channels
// ═══════════════════════════════════════════════════════════

export const generateIdeas = async (
  topic: string,
  channelId: string,
  existingIdeas: string[]
): Promise<string[]> => {
  const ai = getAI();
  const channelStyle = CHANNEL_VIRAL_STYLES[channelId] || "";

  const prompt = `
You are a high-level YouTube Shorts growth strategist.

Channel Strategy:
${channelStyle}

The titles must strongly reflect the channel tone and niche identity.

Your task: Generate exactly 10 COMPLETELY NEW YouTube Shorts titles for this topic.

Previously generated titles (DO NOT repeat or rephrase these):
${existingIdeas.length > 0 ? existingIdeas.join("\n") : "None"}

CRITICAL: Assume this topic has already been used multiple times.
Avoid obvious angles. Avoid common YouTube phrasing.
Each title must explore a DIFFERENT psychological hook.

STRICT RULES:
- Designed ONLY for YouTube Shorts (under 45 seconds).
- Maximum 12 words per title.
- Strong curiosity gap. Clear value or revelation.
- Each title must use a DIFFERENT narrative angle.
- No emojis. No filler words. No clickbait without payoff.

Topic:
${topic && topic.trim() !== "" ? topic : "Generate completely original trending topic angles specific to this channel niche"}

Return ONLY a valid JSON array of 10 strings. No explanations. No markdown.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse ideas:", e);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════
// GENERATE CUSTOM STYLE — unchanged
// ═══════════════════════════════════════════════════════════

export const generateCustomStyle = async (
  topic: string,
  currentContext: string
): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Based on the topic "${topic}" and this context: "${currentContext}", brainstorm a unique and visually stunning art style for a viral YouTube video. Focus on 3D educational animation aesthetics. Provide only a one-sentence highly descriptive style prompt that focuses on texture, lighting, and artistic medium.`,
    config: { thinkingConfig: { thinkingBudget: 8000 } }
  });
  return response.text?.trim() || "Cinematic 8k realism, educational 3D style";
};

// ═══════════════════════════════════════════════════════════
// GENERATE STORYBOARD — unchanged, for all channels except KnowIt
// (KnowIt is handled by generateKnowIt below)
// ═══════════════════════════════════════════════════════════

export const generateStoryboard = async (
  topic: string,
  channelId: string,
  isShort: boolean,
  numScenes: number = 5
): Promise<{
  title: string;
  storyArc: string;
  globalContext: string;
  visualStyle: string;
  scenes: { prompt: string; narration: string; sfx: string }[];
  musicVibe: string;
}> => {
  const channelSystemPrompt = `
${UNIVERSAL_HOOK_RULE}
${CHANNEL_VIRAL_STYLES[channelId] || ""}
`;

  const ai = getAI();
  const format = isShort ? "YouTube Short (9:16)" : "Cinematic (16:9)";

  const channelVisualStyle: Record<string, string> = {
    futurelife: "Ultra cinematic, emotional, dramatic lighting, film-grade realism",
    knowit: "Zachdfilms-style animation, chaotic motion graphics, bold captions, exaggerated expressions, fast zooms, meme energy",
    mindforged: "Dark minimalist tone, deep shadows, sharp contrast, psychological intensity",
    cosmora: "Epic cosmic scale, space cinematography, vast environments, awe-inspiring visuals",
    veiltheory: "Documentary-style realism, archival textures, investigative atmosphere"
  };

  const channelMusicVibe: Record<string, string> = {
    futurelife: "Emotional cinematic score, deep ambient build, dramatic tension",
    knowit: "Fast upbeat electronic beat, energetic, punchy transitions",
    mindforged: "Dark ambient pulse, minimal tension build, subtle bass",
    cosmora: "Epic orchestral space score, vast atmospheric sound",
    veiltheory: "Low investigative documentary drone, suspenseful undertone"
  };

  const enforcedVisualStyle = channelVisualStyle[channelId] || "Cinematic realism";
  const enforcedMusicVibe = channelMusicVibe[channelId] || "Cinematic background score";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
${UNIVERSAL_HOOK_RULE}
${channelSystemPrompt}

Create an engaging ${numScenes}-scene storyboard for a ${format} viral YouTube story: "${topic}".
The script should be snappy, educational, and designed for retention.

CRITICAL SCENE STRUCTURE:
Scene 1: Must follow FIRST SENTENCE RULE strictly. Drop viewer into tension immediately.

ESCALATION RULE: Each scene must increase psychological intensity.
OPEN LOOP RULE: Introduce a key unresolved idea early. Do NOT fully explain until final scene.
REPLAY LOOP RULE: Final scene must connect back to Scene 1 conceptually.

The "visualStyle" is PRE-DEFINED: ${enforcedVisualStyle}
Do NOT invent a different visual style.

For each scene provide:
- aiPrompt: detailed cinematic AI image generation prompt
- narration: the scene narration
- sfx: atmospheric sound effect idea

Return JSON only.
`,
    config: {
      thinkingConfig: { thinkingBudget: 24000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          storyArc: { type: Type.STRING },
          globalContext: { type: Type.STRING },
          visualStyle: { type: Type.STRING },
          musicVibe: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                aiPrompt: { type: Type.STRING },
                narration: { type: Type.STRING },
                sfx: { type: Type.STRING }
              },
              required: ["aiPrompt", "narration", "sfx"]
            }
          }
        },
        required: ["title", "scenes", "musicVibe", "storyArc", "globalContext", "visualStyle"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse storyboard:", e);
    throw new Error("Failed to parse storyboard JSON");
  }
};

// ═══════════════════════════════════════════════════════════
// GENERATE KNOWIT3D STORYBOARD — COMPLETELY REWRITTEN
//
// WHY: The old generateKnowIt was a 10-line generic prompt that
// knew nothing about our system. It produced 5 scenes with
// vague "prompt + narration" pairs. No structure. No character.
// No escalation. No 90-word budget. Just "be educational."
//
// WHAT'S NEW:
// - Uses our proven 5-section script structure:
//   [0–4s] HOOK → [4–12s] REVEAL → [12–27s] BODY → [27–36s] FIX+WARNING → [36–40s] CTA
// - 90-word hard budget enforced in the prompt
// - Body section MUST have 3 sentences at 3 visual scales:
//   [EXTERNAL] → [ORGAN] → [CELLULAR] in any order
// - Each sentence must escalate — pull harder than the last
// - Sentence-to-sentence pull: each sentence opens a door
//   the next sentence walks through
// - Gender detected from the title
// - Shot type hints generated per scene for the image system
// - sfx now matched to medical/body content not generic sounds
// - stockQuery completely removed — KnowIt3D is AI only
// ═══════════════════════════════════════════════════════════

export const generateKnowIt = async (
  topic: string,
  isShort: boolean
): Promise<{
  title: string;
  storyArc: string;
  globalContext: string;
  visualStyle: string;
  scenes: {
    prompt: string;
    narration: string;
    sfx: string;
    shotType?: string;
    scaleLabel?: string;
  }[];
  musicVibe: string;
}> => {
  const ai = getAI();

  // Detect gender from title for character consistency
  const titleLower = topic.toLowerCase();
  const detectedGender =
    titleLower.match(/\bshe\b|\bher\b|\bwoman\b/) ? 'female' :
    titleLower.match(/panic|anxiety|chills|thyroid|silent|liver|jaw|dizzy|heart skip/) ? 'female' :
    'male';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
You are writing a YouTube Shorts script for the channel KnowIt3D.
Brand: "Dangerous, fascinating, useful things that happen to the human body under pressure."

VIDEO TITLE: "${topic}"
CHARACTER GENDER: ${detectedGender}
FORMAT: YouTube Short — 35–40 seconds maximum

══════════════════════════════════════
SCRIPT STRUCTURE — 5 SECTIONS EXACTLY
══════════════════════════════════════

You must output exactly 5 scenes. One per section. In this order:

SCENE 1 — HOOK [0–4s]
- Max 15 words spoken
- Must describe something the viewer has ALREADY felt in their own body
- Creates instant "ME TOO" recognition
- No setup. No intro. Start with the experience.
- Shot type: reaction (Type-A outer state)

SCENE 2 — REVEAL [4–12s]  
- Max 25 words spoken
- Deliver the surprising "why" immediately — no teasing
- One mechanism. One cause. Plain English.
- Opens with: what is actually happening inside
- Shot type: zoom-in (Type-C shallow internal state)

SCENE 3 — BODY [12–27s]
- Max 35 words spoken — THIS IS THE ESCALATION ENGINE
- Must contain EXACTLY 3 sentences
- Each sentence covers a DIFFERENT visual scale — label them:
  [EXTERNAL] — what it looks/feels like from outside OR consequence visible on body
  [ORGAN] — what is happening at the organ or system level inside
  [CELLULAR] — what is happening at the cellular or microscopic level
- The order of these three can be ANY order depending on what serves the topic
- ESCALATION RULE: each sentence must pull harder than the last
- PULL RULE: each sentence opens a question the next sentence answers
- Shot type: internal (Type-D organ state then Type-E macro state)

SCENE 4 — FIX + WARNING [27–36s]
- Max 20 words spoken
- Exactly 2 fixes (short, actionable, everyday)
- Then 1 warning line — short, caring, slightly scary
- "But if [symptom] keeps happening — [consequence short phrase]"
- Shot type: reaction (Type-A outer state)

SCENE 5 — CTA [36–40s]
- Max 8 words spoken
- Must invite ONE specific comment action
- Use one of: "Drop ME TOO", "Drop [emoji]", "Tag someone who [specific thing]", "Has this happened to you?"
- NEVER say "like and subscribe"
- Shot type: reaction (Type-A outer state direct gaze)

══════════════════════════════════════
TOTAL WORD COUNT ACROSS ALL 5 SCENES:
Maximum 90 words spoken. Count carefully.
══════════════════════════════════════

TONE: Calm but urgent. Like a smart friend explaining something slightly scary.
Simple everyday language. No jargon. 12-year-old reading level.

For each scene also provide:
- sfx: one medical or biological sound effect appropriate to the content
  (examples: heartbeat pulse, nerve spark crackle, blood flow rush, pressure build tone,
  tissue impact, cellular pop, tension sting, breath gasp, resolution tone)
- shotType: the shot type label from the instructions above

Return valid JSON only. No markdown. No explanation.
`,
    config: {
      thinkingConfig: { thinkingBudget: 16000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          storyArc: { type: Type.STRING },
          globalContext: { type: Type.STRING },
          visualStyle: { type: Type.STRING },
          musicVibe: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                narration: { type: Type.STRING },
                sfx: { type: Type.STRING },
                shotType: { type: Type.STRING },
                scaleLabel: { type: Type.STRING }
              },
              required: ["prompt", "narration", "sfx"]
            }
          }
        },
        required: ["title", "storyArc", "globalContext", "visualStyle", "musicVibe", "scenes"]
      }
    }
  });

  const text = response.text || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();

  const result = JSON.parse(cleaned);

  // Force correct values regardless of what Gemini returned
  result.visualStyle = `Premium cinematic pseudo-3D medical visualization. ${detectedGender === 'female' ? 'Female' : 'Male'} glass mannequin character. Translucent body. Glowing internal anatomy. Strong blue rim light. Dark moody environment.`;
  result.musicVibe = "Dark cinematic tension build with subtle biological pulse — low heartbeat undertone, occasional nerve sting, resolves at CTA";

  return result;
};

// ═══════════════════════════════════════════════════════════
// GENERATE FUTURE LIFE STORY — unchanged
// ═══════════════════════════════════════════════════════════

export const generateFutureLifeStory = async (
  topic: string,
  numScenes: number = 5
): Promise<{
  title: string;
  storyArc: string;
  globalContext: string;
  visualStyle: string;
  scenes: { aiPrompt: string; narration: string; sfx: string }[];
  musicVibe: string;
}> => {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
Create a highly emotional ${numScenes}-scene YouTube Short storyboard for a Future Life Story titled: "${topic}".

Strict Style Rules:
- First person narration ONLY ("I", "my", "me")
- Scene 1 must start with a powerful regret-based hook from the future
- Emotionally immersive and realistic
- Designed for 30–45 seconds pacing

Structure:
1. Scene 1: Emotional future regret hook
2. Scene 2–3: The mistake or ignored warning
3. Scene 4: Painful future consequence
4. Final Scene: Direct reflective life lesson to viewer

For each scene: prompt, narration (1–2 emotional sentences max), sfx.
Return valid JSON only.
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          storyArc: { type: Type.STRING },
          globalContext: { type: Type.STRING },
          visualStyle: { type: Type.STRING },
          musicVibe: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                narration: { type: Type.STRING },
                sfx: { type: Type.STRING }
              },
              required: ["prompt", "narration", "sfx"]
            }
          }
        },
        required: ["title", "storyArc", "globalContext", "visualStyle", "musicVibe", "scenes"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

// ═══════════════════════════════════════════════════════════
// ENHANCE PROMPT — unchanged
// ═══════════════════════════════════════════════════════════

export const enhancePrompt = async (userPrompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Rewrite this prompt to be hyper-descriptive, cinematic, and detailed, similar to the output of a high-end 3D animation director. Focus on technical motion, volumetric lighting, and material textures. Original: "${userPrompt}"`,
    config: { thinkingConfig: { thinkingBudget: 16000 } }
  });
  return response.text || userPrompt;
};

// ═══════════════════════════════════════════════════════════
// GENERATE IMAGE — updated to use buildPrompt
//
// WHY: The old generateImage built its own prompt inline:
//   "Context: X, Style: Y, Scene: Z"
// That bypassed our entire promptBuilder system.
// Now for KnowIt channel it uses our full character+state system.
// For all other channels the Scene object's aiPrompt is used directly.
//
// The channelId is now passed in so buildPrompt knows which
// character system to use.
// ═══════════════════════════════════════════════════════════

export const generateImage = async (
  scene: Scene,
  project: Project,
  shotType: string = "cinematic shot"
): Promise<string> => {
  const ai = getAI();

  // Use our prompt builder — KnowIt gets full character system,
  // other channels get their original generic prompt
  const fullPrompt = buildPrompt(scene, project, shotType);

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: fullPrompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const base64 =
    result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64) {
    throw new Error("No image returned from Gemini");
  }

  return `data:image/png;base64,${base64}`;
};

// ═══════════════════════════════════════════════════════════
// HUNYUAN BRIDGE HELPER
//
// WHY: generateVideo (Veo) is removed. This replaces it.
// Instead of calling an API, we build the Hunyuan motion prompt
// and return it so the UI can display it in the bridge panel.
// The user copies it, goes to aistudio.tencent.com, pastes it,
// uploads their image, generates the video, and uploads it back.
//
// This function also builds the Flow image prompt for the bridge.
// ═══════════════════════════════════════════════════════════

export const buildBridgePrompts = (
  scene: Scene,
  project: Project,
  shotType: string = "cinematic shot"
): { imagePrompt: string; videoPrompt: string } => {

  const imagePrompt = buildPrompt(scene, project, shotType);

  const organ = "the highlighted biological system";
  const motions: Record<string, string> = {
    "type-a": `Animate a micro-expression shift — eyebrows raise slightly, eyes widen 5–10%, lips part gently. Rim light pulses once softly. Head remains still. Duration 1.5 seconds.`,
    "type-b": `Animate the highlighted body region with a slow pressure pulse — glass surface ripples outward from the zone. Blue glow breathes in and out. Duration 1.5 seconds.`,
    "type-c": `Animate the camera pushing smoothly through the body surface into the interior — speed builds then decelerates as anatomy is revealed. The glass wall parts like frosted fog. Duration 1.5 seconds.`,
    "type-d": `Animate the internal anatomy with biological life — blood vessels pulse rhythmically, nerve sparks travel along pathways, organ contracts and releases once. Particles drift slowly. Duration 2 seconds.`,
    "type-e": `Animate at the microscopic level — cells expand and contract, fluids flow through vessels, membrane walls ripple, glow intensifies at the active biological point. Duration 1.5 seconds.`,
  };

  const shotKey = shotType.toLowerCase().replace(/\s+/g, '-');
  const matchedMotion = motions[shotKey] || motions["type-a"];

  const videoPrompt = `
Image uploaded shows: ${scene.aiPrompt || scene.narrationChunk || 'KnowIt3D body visualization'}

Motion instruction: ${matchedMotion}

Biological motion rules:
- Blood vessels visible → pulse and flow animation
- Nerves visible → spark signals traveling along pathways
- Organs visible → rhythmic contraction and glow
- Skin surface visible → subtle pressure ripple
- Glass surface visible → gentle shimmer and internal glow pulse
- Face visible → micro-expression and subtle eye movement

Duration: 1.5–2.5 seconds maximum. Nothing static. Everything alive.
  `.trim();

  return { imagePrompt, videoPrompt };
};

// ═══════════════════════════════════════════════════════════
// GENERATE NARRATION — unchanged
// ═══════════════════════════════════════════════════════════

export const generateNarration = async (
  script: string,
  voiceName: string = 'Zephyr',
  styleInstruction: string = '',
  speed: 'slow' | 'normal' | 'fast' = 'normal',
  energy: 'low' | 'normal' | 'high' = 'normal'
) => {
  const ai = getAI();
  const speedText = speed === 'fast' ? 'quickly' : speed === 'slow' ? 'slowly' : 'naturally';
  const energyText = energy === 'high' ? 'energetically' : energy === 'low' ? 'calmly' : 'professionally';
  const finalPrompt = `Instruction: ${styleInstruction || 'Narrate clearly'}. Speak ${speedText} and ${energyText}. Script: ${script}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: finalPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as any },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");
  return base64Audio;
};

// ═══════════════════════════════════════════════════════════
// AUDIO UTILS — unchanged
// ═══════════════════════════════════════════════════════════

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
