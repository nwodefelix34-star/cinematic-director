import { generateImage, generateVideo } from "../services/geminiService";

export async function buildImage(
  prompt: string,
  aspectRatio: '9:16' | '16:9',
  context: string,
  style: string
) {
  return await generateImage(
    prompt,
    aspectRatio,
    context,
    style
  );
}

export async function buildVideo(
  prompt: string,
  imageUrl: string,
  aspectRatio: '9:16' | '16:9',
  style: string,
  context: string,
  resolution: string
) {
  return await generateVideo(
    prompt,
    imageUrl,
    aspectRatio,
    style,
    context,
    resolution
  );
}
