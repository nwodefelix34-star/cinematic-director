import { CharacterProfile, EnvironmentProfile } from "../types"

export interface EntityResult {
  characters: CharacterProfile[]
  environments: EnvironmentProfile[]
}

interface StoryboardScene {
  aiPrompt?: string
  stockQuery?: string
  narration?: string
}

interface StoryboardResult {
  title?: string
  globalContext?: string
  scenes: StoryboardScene[]
}

export function analyzeEntities(result: StoryboardResult): EntityResult {

  const characters: CharacterProfile[] = []
  const environments: EnvironmentProfile[] = []

  // combine all text from storyboard
  let combined = ""

  if (result.title) combined += result.title + " "
  if (result.globalContext) combined += result.globalContext + " "

  for (const scene of result.scenes) {

    if (scene.aiPrompt) combined += scene.aiPrompt + " "
    if (scene.stockQuery) combined += scene.stockQuery + " "
    if (scene.narration) combined += scene.narration + " "

  }

  const lower = combined.toLowerCase()

  // ---------- CHARACTER DETECTION ----------

  if (lower.includes("astronaut")) {

    characters.push({
      id: "char-astronaut",
      identityTag: "astronaut_001",
      name: "Astronaut",
      description: "Professional astronaut exploring outer space",

      appearance: {
        gender: "unknown",
        age: "adult",
        ethnicity: "unknown",
        face: "hidden behind reflective helmet visor",
        hair: "not visible",
        eyes: "not visible"
      },

      clothing: "white NASA space suit with mission patches",
      accessories: "large oxygen backpack, reflective helmet visor"
    })

  }

  if (lower.includes("boy")) {

    characters.push({
      id: "char-boy",
      identityTag: "boy_001",
      name: "Young Boy",
      description: "Curious young boy protagonist",

      appearance: {
        gender: "male",
        age: "child",
        ethnicity: "unspecified",
        face: "round youthful face",
        hair: "short messy hair",
        eyes: "bright curious eyes"
      },

      clothing: "simple t-shirt and shorts",
      accessories: "small backpack"
    })

  }

  // ---------- ENVIRONMENT DETECTION ----------

  if (lower.includes("mars")) {

    environments.push({
      id: "env-mars",
      name: "Mars Surface",
      description: "Vast red rocky desert of Mars",

      lighting: "harsh sunlight with long shadows",
      weather: "dust storms",
      atmosphere: "thin dusty atmosphere"
    })

  }

  if (lower.includes("forest")) {

    environments.push({
      id: "env-forest",
      name: "Forest",
      description: "Dense green forest",

      lighting: "soft filtered sunlight",
      atmosphere: "humid natural environment"
    })

  }

  return {
    characters,
    environments
  }

}
