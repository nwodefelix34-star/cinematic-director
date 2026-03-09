import { CharacterProfile, EnvironmentProfile } from "../types"

export interface EntityResult {
  characters: CharacterProfile[]
  environments: EnvironmentProfile[]
}


export function analyzeEntities(script: string): EntityResult {

  const characters: CharacterProfile[] = []
  const environments: EnvironmentProfile[] = []

  const lower = script.toLowerCase()

  // very basic detection for now
  if (lower.includes("astronaut")) {
    characters.push({
      id: "char-astronaut",
      name: "Astronaut",
      description: "Professional space explorer wearing a NASA space suit",

      appearance: {
        gender: "unknown",
        age: "adult"
      },

      clothing: "white NASA space suit",
      accessories: "helmet, oxygen backpack"
    })
  }

  if (lower.includes("mars")) {
    environments.push({
      id: "env-mars",
      name: "Mars Surface",
      description: "Red rocky landscape of Mars",

      lighting: "harsh sunlight",
      atmosphere: "dusty thin atmosphere"
    })
  }

  return {
    characters,
    environments
  }
}
