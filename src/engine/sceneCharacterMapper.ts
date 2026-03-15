import { Scene, CharacterProfile } from "../types"

export function mapCharactersToScenes(
  scenes: Scene[],
  characters: CharacterProfile[]
): Scene[] {

  if (!characters || characters.length === 0) return scenes

  return scenes.map(scene => {

    const text =
      `${scene.aiPrompt || ""} ${scene.stockQuery || ""} ${scene.narrationChunk || ""}`
      .toLowerCase()

    const matchedCharacters = characters
      .filter(char =>
        text.includes(char.name.toLowerCase())
      )
      .map(char => char.id)

    return {
      ...scene,
      characterIds: matchedCharacters.length > 0
        ? matchedCharacters
        : undefined
    }

  })
}
