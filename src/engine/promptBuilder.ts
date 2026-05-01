import { Scene, Project, CharacterProfile, EnvironmentProfile } from "../types"

// ═══════════════════════════════════════════════════════════
// KNOWIT3D CHARACTER SYSTEM
// ═══════════════════════════════════════════════════════════
//
// WHY: The old buildPrompt was completely generic. It described
// characters using a simple name + clothing approach. For KnowIt3D
// we need a locked, specific character description that stays
// consistent across every single shot. The old system would produce
// a different-looking person every time because it gave Imagen
// too much freedom to interpret.
//
// WHAT WE LOCKED:
// - Exact face shape, jaw, cheekbones, nose — not just "young male"
// - Exact hair length and style
// - The glass body transition point (collarbone)
// - Hands and feet as realistic skin
// - Two separate descriptions: male and female
// ═══════════════════════════════════════════════════════════

const KNOWIT_CHAR_MALE = `A young adult male in his early-to-mid 20s. Face: slightly angular jaw, defined cheekbones, medium-width nose, close-cropped dark brown hair slightly longer on top, light olive complexion, smooth skin, no facial hair, deep-set eyes. Expression: mild concern — brows slightly lowered, eyes slightly widened, lips neutral or slightly parted. Face and neck are fully realistic human skin. Hands and feet are fully realistic human skin. The body from collarbone downward is a smooth translucent glass-like mannequin shell — glossy, slightly frosted, see-through — with glowing internal anatomy visible through it.`

const KNOWIT_CHAR_FEMALE = `A young adult female in her early-to-mid 20s. Face: soft oval face shape, defined but gentle cheekbones, medium-width nose, dark hair worn natural or loosely pulled back, light complexion, smooth skin, deep-set expressive eyes. Expression: mild concern or curiosity — brows slightly raised, eyes open and alert, lips neutral. Face and neck are fully realistic human skin. Hands and feet are fully realistic human skin. The body from collarbone downward is a smooth translucent glass-like mannequin shell — glossy, slightly frosted, see-through — with glowing internal anatomy visible through it.`

// ═══════════════════════════════════════════════════════════
// 4 CHARACTER STATES
// ═══════════════════════════════════════════════════════════
//
// WHY: The old system had one character description for every shot.
// KnowIt3D needs the character to look different depending on what
// the camera is doing. A wide reaction shot looks different from
// a shot where the camera is inside the body looking at neurons.
//
// State 1 — OUTER: Normal. Skin face, glass body. Used for reaction shots.
// State 2 — SURFACE CLOSE-UP: Camera close to a skin area (jaw, arm, leg).
//           That specific area becomes glass so you see just beneath the surface.
//           Used when showing something happening near the skin.
// State 3 — SHALLOW INTERNAL: Camera just inside the glass body shell.
//           Glass walls still visible at edges. Organs glowing inside.
//           Used for chest cavity, torso internal views.
// State 4 — DEEP INTERNAL: Camera deep inside a specific organ or system.
//           No glass visible — you are too deep inside.
//           Used for neuron-level shots, blood vessel interiors, cell views.
// ═══════════════════════════════════════════════════════════

const STATE_SUFFIX: Record<number, string> = {
  1: `CHARACTER STATE — OUTER: Face, neck, hands and feet show fully realistic human skin. Body torso and limbs are smooth translucent glass shell with glowing anatomy visible inside. Strong blue rim light around entire figure.`,

  2: `CHARACTER STATE — SURFACE CLOSE-UP: The specific body part in focus transitions from realistic skin to a glass-like translucent texture at the surface, revealing the anatomical layer just beneath. The skin appears to dissolve into frosted glass at that zone. Internal detail visible just below the surface. Rest of the visible body maintains its normal state.`,

  3: `CHARACTER STATE — SHALLOW INTERNAL: Camera positioned just inside the outer glass shell of the body. The glass walls are still visible at the edges of the frame as a frosted translucent boundary. Inside: hyper-detailed glowing organs. Bright blue nerves and vessels. Deep red blood vessels pulsing. Moist glossy biological textures. Soft internal lighting makes everything look alive.`,

  4: `CHARACTER STATE — DEEP INTERNAL: Camera deep inside a specific organ or biological system. The outer glass shell is no longer visible — you are too deep inside. Pure anatomical environment: hyper-detailed glowing biological structures, moist glossy tissue surfaces, bright blue nerve signals, deep red pulsing blood vessels, visible cell structures, organic wet textures. No glass. No shell. Only biology.`
}

// ═══════════════════════════════════════════════════════════
// ANATOMY STYLE CONSTANT
// ═══════════════════════════════════════════════════════════
//
// WHY: This description needs to appear in every internal shot
// to keep the anatomy style consistent. Without it, Imagen would
// interpret "internal anatomy" differently every time.
// ═══════════════════════════════════════════════════════════

const ANATOMY_STYLE = `Internal anatomy style: bright blue glowing nerves and vessel pathways, deep red pulsing blood vessels, moist glossy biological tissues, smooth muscle fibers, visible bone with subtle white glow. All organs have the same wet glossy medical-visualization texture and cinematic pseudo-3D quality.`

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT SYSTEM
// ═══════════════════════════════════════════════════════════
//
// WHY: The old system put the character in one generic dark lab
// for every single video. After 10 videos, every video looks
// identical. The environment should change by content type —
// but always keep the blue cinematic aesthetic so the brand stays consistent.
//
// mystery  → dark bedroom/home (relatable, familiar)
// danger   → dark clinical lab (cold, serious, medical)
// extreme  → scenario-matched (snake=outdoors, shark=underwater etc.)
// silent   → near-black void (maximum focus, quiet dread)
// story    → warm dark (subtle amber tones, emotional warmth)
// ═══════════════════════════════════════════════════════════

const ENVIRONMENTS: Record<string, string> = {
  mystery: `Background: dark moody domestic environment — blurred bedroom or living space, deep navy shadows, minimal detail. Creates a relatable familiar atmosphere. Strong blue rim light on character.`,
  danger:  `Background: dark clinical medical environment — blurred lab equipment, monitor screens with faint data readouts, deep charcoal and navy tones. Cold serious atmosphere. Strong blue rim light on character.`,
  extreme: `Background: dark dramatic scenario environment — cinematic depth, all colors subdued and desaturated except for the character's vivid blue rim light. Atmosphere matches the extreme event being depicted.`,
  silent:  `Background: near-black void with very subtle dark charcoal gradient. Maximum emphasis on character. Only the blue rim light and internal organ glow provide color. Stripped back, serious, quiet danger.`,
  story:   `Background: dark environment with very subtle warm dark amber gradient — not bright, just a warmth in the shadows. Creates emotional connection. Strong blue rim light on character maintains brand consistency.`
}

// ═══════════════════════════════════════════════════════════
// GENDER DETECTION
// ═══════════════════════════════════════════════════════════
//
// WHY: Some scripts use a female character (story touch scripts,
// silent killer topics). The old system had no gender awareness
// at all — it always defaulted to a generic character. We now
// read pronouns and topic signals from the script narration
// to automatically choose the right character.
// ═══════════════════════════════════════════════════════════

function detectGender(text: string): 'male' | 'female' {
  const t = text.toLowerCase()
  if (t.match(/\bshe\b|\bher\b|\bwoman\b|\bfemale\b/)) return 'female'
  if (t.match(/\bhe\b|\bhis\b|\bman\b|\bmale\b/)) return 'male'
  // Topic-based defaults — silent killer and story topics skew female
  if (t.match(/panic|anxiety|chills|thyroid|silent|liver|jaw|dizzy|heart skip|pre-diabetes/)) return 'female'
  return 'male'
}

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// ═══════════════════════════════════════════════════════════
//
// WHY: Same reason as gender detection — we need to auto-assign
// the right environment without the user having to choose manually.
// ═══════════════════════════════════════════════════════════

function detectEnvironment(text: string): string {
  const t = text.toLowerCase()
  if (t.match(/snake|shark|lightning|car crash|fall|dog bite|bee|struck/)) return ENVIRONMENTS.extreme
  if (t.match(/silent|pressure|inflammation|liver|clot|pre-diabetes|blood sugar/)) return ENVIRONMENTS.silent
  if (t.match(/\bshe\b|\bher\b/) && t.match(/ignored|found|kept|had no/)) return ENVIRONMENTS.story
  if (t.match(/leg jump|goosebump|ear ring|phantom|jaw click|muscle twitch|dizzy|vision|heart skip/)) return ENVIRONMENTS.mystery
  return ENVIRONMENTS.danger
}

// ═══════════════════════════════════════════════════════════
// CHARACTER STATE DETECTION
// ═══════════════════════════════════════════════════════════
//
// WHY: The shot type tells us which state to use.
// A = reaction shot → always State 1 (outer, face visible)
// B = external body → State 1 normally, State 2 if close-up to skin
// C = zoom-in → State 3 (just crossed the glass wall)
// D = internal → State 3 (inside shell, glass walls at edges)
// E = macro → State 4 (deep inside, pure biology, no glass)
// ═══════════════════════════════════════════════════════════

function detectState(shotType: string): number {
  const s = shotType.toLowerCase()
  if (s.includes('reaction') || s.includes('type-a') || s.includes('outer')) return 1
  if (s.includes('surface') || s.includes('type-b') || s.includes('external-close')) return 2
  if (s.includes('zoom') || s.includes('type-c') || s.includes('shallow')) return 3
  if (s.includes('internal') || s.includes('type-d')) return 3
  if (s.includes('macro') || s.includes('type-e') || s.includes('deep') || s.includes('cellular')) return 4
  // Default based on keywords
  if (s.includes('close')) return 2
  if (s.includes('inside') || s.includes('organ') || s.includes('vessel')) return 3
  return 1
}

// ═══════════════════════════════════════════════════════════
// ANIMAL LOGIC
// ═══════════════════════════════════════════════════════════
//
// WHY: Animal attack videos need an animal in the frame.
// For snake and bee — if we're in State 3/4 (internal view)
// we show a glass anatomical animal to match the brand aesthetic.
// For shark, dog — always photorealistic to create genuine threat contrast.
// ═══════════════════════════════════════════════════════════

function buildAnimalNote(text: string, state: number): string {
  const t = text.toLowerCase()
  if (t.match(/snake|venom/)) {
    return state >= 3
      ? `Include a translucent glass-style snake with glowing internal venom sacs visible through its body — matching the character's glass aesthetic. The venom glows amber-orange inside.`
      : `Include a photorealistic snake in the scene — realistic animal appearance creating genuine threat contrast with the glass character.`
  }
  if (t.match(/\bbee\b|\bsting\b/)) {
    return state >= 3
      ? `Include a translucent glass-style bee with glowing internal venom gland visible through its body.`
      : `Include a photorealistic bee near the sting site on the skin surface.`
  }
  if (t.match(/shark/)) return `Include a photorealistic shark in the scene — realistic predator appearance creating genuine threat contrast with the glass character.`
  if (t.match(/dog bite|dog's jaw/)) return `Include a photorealistic dog jaw or teeth at the wound zone — realistic animal appearance.`
  return ''
}

// ═══════════════════════════════════════════════════════════
// STYLE CONSTANT
// ═══════════════════════════════════════════════════════════

const STYLE_SUFFIX = `Cinematic lighting. Premium pseudo-3D medical visualization. Ultra-sharp quality. Glossy biological textures. Vertical 9:16 aspect ratio, portrait orientation.`

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT — buildPrompt
// ═══════════════════════════════════════════════════════════
//
// WHY THIS STRUCTURE:
// The old buildPrompt just slotted in generic character/environment
// descriptions. The new one detects what kind of video this is,
// who the character is, what state the camera is in, and builds
// a highly specific prompt from those answers.
//
// For non-KnowIt channels — falls back to the original generic system
// so we don't break MindForged, Cosmora, VeilTheory, or FutureLife.
// ═══════════════════════════════════════════════════════════

export function buildPrompt(
  scene: Scene,
  project: Project,
  shotType: string = "cinematic shot"
): string {

  // ── KnowIt3D Channel — use our full system ──
  if (project.channelId === 'knowit') {
    return buildKnowItPrompt(scene, project, shotType)
  }

  // ── All other channels — original generic system (unchanged) ──
  return buildGenericPrompt(scene, project, shotType)
}

// ═══════════════════════════════════════════════════════════
// KNOWIT3D PROMPT BUILDER
// ═══════════════════════════════════════════════════════════

function buildKnowItPrompt(scene: Scene, project: Project, shotType: string): string {

  // Combine all available text for detection
  const allText = [
    scene.narrationChunk || '',
    scene.aiPrompt || '',
    project.title || '',
    project.globalContext || ''
  ].join(' ')

  // Detect gender, environment, state
  const gender = detectGender(allText)
  const charDesc = gender === 'female' ? KNOWIT_CHAR_FEMALE : KNOWIT_CHAR_MALE
  const envDesc = detectEnvironment(allText)
  const state = detectState(shotType)
  const stateSuffix = STATE_SUFFIX[state]

  // Animal note — only included if relevant
  const animalNote = buildAnimalNote(allText, state)

  // Base scene description — what this specific shot is showing
  const baseScene = scene.aiPrompt || scene.narrationChunk || ''

  // Include anatomy style only for States 3 and 4
  const anatomyNote = state >= 3 ? ANATOMY_STYLE : ''

  const prompt = `
${charDesc}

${anatomyNote}

Scene: ${baseScene}

${stateSuffix}

${envDesc}

${animalNote}

${STYLE_SUFFIX}
`.trim().replace(/\n{3,}/g, '\n\n')

  return prompt
}

// ═══════════════════════════════════════════════════════════
// GENERIC PROMPT BUILDER — original system for other channels
// ═══════════════════════════════════════════════════════════
//
// WHY: We keep this completely intact so MindForged, Cosmora,
// VeilTheory, and FutureLife all continue working exactly
// as they did before. We only changed KnowIt.
// ═══════════════════════════════════════════════════════════

function buildGenericPrompt(scene: Scene, project: Project, shotType: string): string {

  let characters: CharacterProfile[] = []

  if (scene.characterIds && scene.characterIds.length > 0) {
    characters = project.characters?.filter(c => scene.characterIds?.includes(c.id)) || []
  } else {
    characters = project.characters || []
  }

  const environment = project.environments?.find(env => env.id === scene.environmentId)

  const characterDescription = characters.map(c => describeCharacter(c)).join("\n")
  const environmentDescription = environment ? describeEnvironment(environment) : ""
  const basePrompt = scene.aiPrompt || scene.stockQuery || ""
  const style = project.visualStyle || "cinematic realism"

  return `
${shotType} of ${basePrompt}

${characterDescription}

${environmentDescription ? `set inside ${environmentDescription}` : ""}

visual style: ${style},
cinematic lighting,
ultra detailed,
high realism,
8k texture detail,
shallow depth of field
`.trim()
}

// ── Helpers for generic system (unchanged) ──

function describeCharacter(character?: CharacterProfile) {
  if (!character) return ""
  return `
character description:
${character.name || "character"},
identity anchor: ${character.identityTag || "character_main"},
reference image: ${character.referenceImage || "none"},
${character.description || ""},

appearance:
gender: ${character.appearance?.gender || ""},
age: ${character.appearance?.age || ""},
ethnicity: ${character.appearance?.ethnicity || ""},
face: ${character.appearance?.face || ""},
hair: ${character.appearance?.hair || ""},
eyes: ${character.appearance?.eyes || ""},
facial hair: ${character.appearance?.facialHair || ""},

clothing:
${character.clothing || ""},

accessories:
${character.accessories || ""}
`
}

function describeEnvironment(environment?: EnvironmentProfile) {
  if (!environment) return ""
  return `
environment description:
${environment.name || ""},
${environment.description || ""},

lighting: ${environment.lighting || ""},
weather: ${environment.weather || ""},
time of day: ${environment.timeOfDay || ""},
atmosphere: ${environment.atmosphere || ""}
`
}
