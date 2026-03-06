import { 
  generateStoryboard,
  generateFutureLifeStory,
  generateKnowIt
} from "../services/geminiService";


export async function buildStoryboard(
  topic: string,
  channelId: string,
  isVertical: boolean,
  numScenes: number
) {
  return await generateStoryboard(
    topic,
    channelId,
    isVertical,
    numScenes
  );
}


export async function buildFutureLifeStoryboard(
  topic: string,
  isVertical: boolean,
  numScenes: number
) {
  return await generateFutureLifeStory(
    topic,
    isVertical,
    numScenes
  );
}


export async function buildKnowItStoryboard(
  topic: string,
  isVertical: boolean,
  numScenes: number
) {
  return await generateKnowIt(
    topic,
    isVertical,
    numScenes
  );
}
