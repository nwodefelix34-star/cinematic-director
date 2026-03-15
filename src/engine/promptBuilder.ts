import { Scene, Project, CharacterProfile, EnvironmentProfile } from "../types"

export function buildPrompt(
  scene: Scene,
  project: Project,
  shotType: string = "cinematic shot"
) {

  let characters: CharacterProfile[] = []

if (scene.characterIds && scene.characterIds.length > 0) {

  characters =
    project.characters?.filter(c =>
      scene.characterIds?.includes(c.id)
    ) || []

} else {

  characters = project.characters || []

}

const environment =
  project.environments?.find(env =>
    env.id === scene.environmentId
  )
  
  const characterDescription = characters
  .map(c => describeCharacter(c))
  .join("\n")
  const environmentDescription =
  environment ? describeEnvironment(environment) : ""
  const basePrompt = scene.aiPrompt || scene.stockQuery || ""

  const style = project.visualStyle || "cinematic realism"

  const finalPrompt = `
${shotType} of ${basePrompt},

${characterDescription},

${environmentDescription ? `set inside ${environmentDescription},` : ""}

visual style: ${style},
cinematic lighting,
ultra detailed,
high realism,
8k texture detail,
shallow depth of field
`

  return finalPrompt.trim()
}

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
