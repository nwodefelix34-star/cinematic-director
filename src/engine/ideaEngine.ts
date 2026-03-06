import { generateIdeas } from "../services/geminiService";

export async function generateIdeaList(
  topic: string,
  channelId: string,
  existingIdeas: string[]
) {
  const ideas = await generateIdeas(
    topic,
    channelId,
    existingIdeas
  );

  return ideas;
}
