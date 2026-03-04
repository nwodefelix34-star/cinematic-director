import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

// Standard AI fetch utility - creates a fresh instance per call to pick up the most current API key
const getAI = () =>
  new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

const UNIVERSAL_HOOK_RULE = `
FIRST SENTENCE RULE:

- The first sentence must immediately create tension.
- No greetings.
- No slow introduction.
- No general statements.
- No “Have you ever”.
- No explaining context first.
- Start with a strong, direct, destabilizing line.
- The viewer must feel pulled in instantly.
`;

// ===============================
// CHANNEL SHORTS VIRAL STYLES (UPGRADED)
// ===============================
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
- No “because”.
- No finished explanations.

REALITY ANCHOR RULE:
- Titles must refer to real human behavior.
- Avoid poetic metaphors as the main structure.
- Focus on actions, habits, emotions, or mental patterns.
- If the title sounds like a quote page, rewrite it.

CURIOSITY ENFORCEMENT:

- Title must make the viewer ask:
  “Why?” or “What do you mean?”
- If the title answers the question fully, rewrite it.

STORY STRUCTURE RULE:

Scene 1:
Calm confrontation. Quietly challenge the viewer’s self-perception.

Scene 2:
Reveal a familiar behavior pattern.

Scene 3:
Hint at the hidden psychological mechanism.

Scene 4:
Expose the cost of staying unconscious.

Final Scene:
Deliver a simple but unsettling realization.
No motivational ending.
No soft encouragement.

  HOOK STRUCTURE (Scene 1):
  - Direct confrontation.
  - Challenge a belief immediately.
  - No intro.
  - No setup.
  - Example tone: "You don’t think for yourself."

  FIRST SENTENCE TONE:
Direct psychological confrontation.
Use "You" or "Your".
Calm but cutting.
No soft motivation.

  SCENE FLOW:
  Scene 1 → Psychological attack  
  Scene 2 → Reveal hidden pattern  
  Scene 3 → Explain why you do this  
  Scene 4 → Identity shift realization  
  Final Scene → Short sharp awakening statement  

  NARRATION RULES:
  - Second person ONLY.
  - Short sentences.
  - No academic words.
  - No motivational advice.

  PACING:
  - Fast.
  - No filler.
  - No long explanations.

  ENDING RULE:
  - End with a powerful identity-shift sentence.
  - Must feel slightly uncomfortable.

  LANGUAGE:
  - Simple words only.
  - 12-year-old reading level.
  `,

  cosmora: `
CHANNEL DNA:

Core Tone:
Cosmic awe.
Reality is vast and slightly unsettling.
The universe feels bigger than human comfort.

TITLE STRUCTURE:
- Start with a scale-based statement.
- Must feel large or reality-bending.
- Simple language.
- No heavy astrophysics jargon.
- Maximum 10 words.
- Leave a sense of unanswered mystery.

HOOK STRUCTURE (Scene 1):
- Start at massive scale (galaxies, time, universe).
- Immediately destabilize a common belief.
- Make the viewer feel small in a powerful way.

FIRST SENTENCE TONE:
Start with a massive universe-level statement.
Make the viewer feel small immediately.
No slow setup.

STORY STRUCTURE RULE:

Scene 1:
Massive scale reveal.

Scene 2:
Introduce a surprising fact.

Scene 3:
Expand the scale further.

Scene 4:
Hint that what we know is incomplete.

Final Scene:
End with a universe-altering realization.
No classroom tone.
No “science lesson” vibe.
Make it feel cinematic.
`,

  veiltheory: `
CHANNEL DNA:

Core Tone:
Quiet suspicion.
Controlled narrative tension.
Subtle reality cracks.

TITLE STRUCTURE:
- Must feel like something is “off.”
- Avoid dramatic conspiracy wording.
- No all caps.
- No aggressive accusations.
- Maximum 12 words.
- Use calm but unsettling phrasing.

HOOK STRUCTURE (Scene 1):
- Start with a statement that feels slightly wrong.
- Make the viewer question what they think they know.

FIRST SENTENCE TONE:
Start with a calm but unsettling contradiction.
Sound reasonable at first… then slightly wrong.
Make the viewer think, “Wait… what?”
No dramatic shouting.

STORY STRUCTURE RULE:

Scene 1:
Introduce a subtle contradiction.

Scene 2:
Present an overlooked detail.

Scene 3:
Hint at an alternative explanation.

Scene 4:
Increase uncertainty without full exposure.

Final Scene:
End with unresolved tension.
Do NOT fully explain everything.
Leave space for doubt.

Language Rule:
Simple words.
No dramatic exaggeration.
No cliché conspiracy phrases.
`,

  futurelife: `
CHANNEL DNA:

Core Tone:
Emotional future regret.
Cinematic and immersive.
Feels like a scene from a dystopian movie.

TITLE STRUCTURE:
- Must start with a future time reference or warning.
- Must feel personal.
- Maximum 12 words.
- Simple emotional language.
- No tech jargon.

HOOK STRUCTURE (Scene 1):
- Begin in the future.
- Immediate regret or warning.
- First-person narration ONLY.

FIRST SENTENCE TONE:
Start personal.
Sound like something that already happened.
Immediate emotional weight.
Make it feel close to the viewer’s life.

STORY STRUCTURE RULE:

Scene 1:
Future regret hook.

Scene 2:
Flashback to present-day mistake.

Scene 3:
Show ignored warning sign.

Scene 4:
Reveal painful future consequence.

Final Scene:
Direct emotional message to viewer.
No motivational fluff.
Make it feel real.

Language Rule:
Very simple.
Emotional.
First person only ("I", "me", "my").
No technical AI explanations.
`,

  knowit: `
CHANNEL DNA:

Core Tone:
Extremely fast.
Unexpected.
Instant curiosity hit.

TITLE STRUCTURE:
- Maximum 8 words.
- Extremely simple.
- Clear shocking statement.
- Must feel instantly understandable.
- No filler words.
- No poetic phrasing.

HOOK STRUCTURE (Scene 1):
- Start with the shocking fact immediately.
- No buildup.
- No intro.

FIRST SENTENCE TONE:
Start with a shocking fact.
No setup.
No introduction.
No explanation.
Instant mental jolt.

STORY STRUCTURE RULE:

Scene 1:
Drop a surprising fact instantly.

Scene 2:
Explain briefly in simple words.

Scene 3:
Add a second twist or surprising detail.

Scene 4:
Give quick real-world implication.

Final Scene:
End clean.
No motivation.
No reflection.
No lesson.
Just impact.

Language Rule:
Very simple.
10-year-old reading level.
Short sentences.
Fast pacing.
`,
};

// ===============================
// GENERATE SHORTS IDEAS (All Channels)
// ===============================
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

Your task:
Generate exactly 10 COMPLETELY NEW YouTube Shorts titles for this topic.

Previously generated titles (DO NOT repeat or rephrase these):
${existingIdeas.length > 0 ? existingIdeas.join("\n") : "None"}

CRITICAL:
Assume this topic has already been used multiple times.
Avoid obvious angles.
Avoid common YouTube phrasing.
Avoid repeating mainstream ideas.
Each title must explore a DIFFERENT psychological hook.

STRICT RULES:
- Designed ONLY for YouTube Shorts (under 45 seconds).
- Maximum 12 words per title.
- Strong curiosity gap.
- Clear value or revelation.
- Each title must use a DIFFERENT narrative angle (shock, contradiction, secret, myth-busting, warning, what-if, hidden truth, unexpected fact, future consequence, etc).
- No emojis.
- No filler words.
- No clickbait without payoff.
- Sound like top-performing Shorts creators in THIS niche.

Topic:
${topic && topic.trim() !== "" ? topic : "Generate completely original trending topic angles specific to this channel niche"}

Return ONLY a valid JSON array of 10 strings.
No explanations.
No markdown.
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

/**
 * Enhances a style description into a high-quality visual prompt.
 */
export const generateCustomStyle = async (topic: string, currentContext: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Based on the topic "${topic}" and this context: "${currentContext}", brainstorm a unique and visually stunning art style for a viral YouTube video. Focus on 3D educational animation aesthetics.
    Provide only a one-sentence highly descriptive style prompt that focuses on texture, lighting, and artistic medium (e.g. "Hyper-clean 3D claymation with soft sub-surface scattering and vibrant educational lighting").`,
    config: {
      thinkingConfig: { thinkingBudget: 8000 }
    }
  });
  return response.text?.trim() || "Cinematic 8k realism, educational 3D style";
};

/**
 * Generates a full multi-scene storyboard based on a topic.
 */
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
  console.log("API KEY:", import.meta.env.VITE_API_KEY);
  const format = isShort ? "YouTube Short (9:16)" : "Cinematic (16:9)";
    const channelVisualStyle = {
  futurelife: "Ultra cinematic, emotional, dramatic lighting, film-grade realism",
      knowit: "Zachdfilms-style animation, chaotic motion graphics, bold captions, exaggerated expressions, fast zooms, meme energy",
  mindforged: "Dark minimalist tone, deep shadows, sharp contrast, psychological intensity",
  cosmora: "Epic cosmic scale, space cinematography, vast environments, awe-inspiring visuals",
  veiltheory: "Documentary-style realism, archival textures, investigative atmosphere"
};

const enforcedVisualStyle =
  channelVisualStyle[channelId as keyof typeof channelVisualStyle]
  || "Cinematic realism";
    const channelMusicVibe = {
  futurelife: "Emotional cinematic score, deep ambient build, dramatic tension",
  knowit: "Fast upbeat electronic beat, energetic, punchy transitions",
  mindforged: "Dark ambient pulse, minimal tension build, subtle bass",
  cosmora: "Epic orchestral space score, vast atmospheric sound",
  veiltheory: "Low investigative documentary drone, suspenseful undertone"
};

const enforcedMusicVibe =
  channelMusicVibe[channelId as keyof typeof channelMusicVibe]
  || "Cinematic background score";
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
${UNIVERSAL_HOOK_RULE}

${channelSystemPrompt}

Create an engaging ${numScenes}-scene storyboard for a ${format} viral YouTube story:
"${topic}". 
    The script should be snappy, educational, and designed for retention.

CRITICAL SCENE STRUCTURE:

Scene 1:
- Must follow FIRST SENTENCE RULE strictly.
- First narration line must be destabilizing.
- No setup. No context. No explanation.
- Drop viewer into tension immediately.

If Scene 1 feels soft, rewrite it before finishing.

ESCALATION RULE:

- Each scene must increase psychological intensity.
- No scene should feel safer than the previous one.
- Tension must rise, not flatten.
- Avoid turning into explanation mode.
- Every scene should introduce a deeper layer of truth.

OPEN LOOP RULE:

- Introduce a key unresolved idea early.
- Do NOT fully explain it until the final scene.
- Each scene should hint at something deeper.
- The viewer must feel: “Wait… where is this going?”
- The final scene must pay off the tension.

REPLAY LOOP RULE:

- The final scene must connect conceptually to Scene 1.
- The ending line should feel like it could loop back into the first line.
- Create narrative circularity.
- When the video restarts, it should feel seamless.

    Titles must use simple, everyday language.
Avoid complex academic or technical vocabulary.
Write titles at a middle-school reading level.
If a complex idea is needed, express it in plain words.

    Titles must:
- Be instantly understandable in under 1 second.
- Avoid jargon, academic terms, or rare vocabulary.
- Sound like something a 15-year-old could understand.
- Still feel powerful, dramatic, or surprising.
- Use emotional triggers like fear, curiosity, shock, warning, secret, or hidden truth.

    Provide a "globalContext" for character/world consistency.

The "visualStyle" is PRE-DEFINED for this channel:
${enforcedVisualStyle}

Do NOT invent a different visual style.
Use the exact style above.
    
    For each scene, provide:

- aiPrompt: a highly detailed cinematic AI image generation prompt (lighting, camera, mood, depth, realism, composition).
- stockQuery: a simple 3-6 word searchable phrase suitable for stock image search (clear, direct, no cinematic language).
- narration: the scene narration.
- sfx: an atmospheric sound effect idea.

    The response must be in JSON format.`,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
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
                stockQuery: { type: Type.STRING },
                narration: { type: Type.STRING },
                sfx: { type: Type.STRING }
              },
              required: ["aiPrompt", "stockQuery", "narration", "sfx"]
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
  alert("Storyboard raw response: " + response.text);
  throw new Error("Failed to parse storyboard JSON");
  }
};  

/**
 * Generates a KnowIt educational storyboard (Shorts optimized).
 */
export const generateKnowIt = async (
  topic: string,
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
  const ai = getAI();

  const enforcedMusicVibe = "Fast upbeat educational soundtrack";

  const format = isShort ? "YouTube Short (9:16)" : "Cinematic (16:9)";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
Create a highly engaging ${numScenes}-scene educational ${format} storyboard titled: "${topic}".

Style Rules:
- Fast-paced
- Fascinating facts
- High retention
- Clear, simple explanations
- Zachdfilms-style educational energy

Provide:
- title
- storyArc
- globalContext
- visualStyle (must use the enforced style above)
- musicVibe (must use this exact vibe: ${enforcedMusicVibe})

For each scene:
- prompt (visual description)
- narration (1–2 punchy sentences)
- sfx (sound idea)

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

const text = response.text || "{}";
const cleaned = text.replace(/```json|```/g, "").trim();
return JSON.parse(cleaned);
};
  /**
 * Generates a Future Life Story storyboard (Shorts optimized).
 */
export const generateFutureLifeStory = async (
  topic: string,
  numScenes: number = 5
): Promise<{
  title: string;
  storyArc: string;
  globalContext: string;
  visualStyle: string;
  scenes: { aiPrompt: string; stockQuery: string; narration: string; sfx: string }[];
  musicVibe: string;
}> => {
  const ai = getAI();

  const enforcedMusicVibe = "Emotional cinematic background score";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
Create a highly emotional ${numScenes}-scene YouTube Short storyboard for a Future Life Story titled: "${topic}".

Strict Style Rules:
- First person narration ONLY ("I", "my", "me")
- Scene 1 must start with a powerful regret-based hook from the future
- Emotionally immersive and realistic
- Designed for 30–45 seconds pacing
- High retention in first 3 seconds

Structure:
1. Scene 1: Emotional future regret hook
2. Scene 2–3: The mistake or ignored warning
3. Scene 4: Painful future consequence
4. Final Scene: Direct reflective life lesson to viewer

Provide:
- title
- storyArc (1 paragraph summary)
- globalContext (who I am, age, life situation)
- visualStyle (must use the enforced style above)
- musicVibe (must use this exact vibe: ${enforcedMusicVibe})

For each scene:
- prompt (visual description)
- narration (1–2 emotional sentences max)
- sfx (atmospheric sound)

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


/**
 * Uses Gemini Pro to optimize a user prompt for high-quality video generation.
 */
export const enhancePrompt = async (userPrompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Rewrite this prompt to be hyper-descriptive, cinematic, and detailed, similar to the output of a high-end 3D animation director. Focus on technical motion, volumetric lighting, and material textures. Original: "${userPrompt}"`,
    config: {
      thinkingConfig: { thinkingBudget: 16000 }
    }
  });
  return response.text || userPrompt;
};

/**
 * Generates an image for a specific scene.
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: string,
  globalContext: string,
  visualStyle: string
) => {
  const ai = getAI();

  const fullPrompt = `
  ${globalContext ? "Context: " + globalContext : ""}
  Style: ${visualStyle}
  Scene: ${prompt}
  `;

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
    throw new Error("No image returned");
  }

  return `data:image/png;base64,${base64}`;
};

/**
 * Generates a video from an image using the Veo 3.1 model.
 */
export const generateVideo = async (
  prompt: string, 
  base64Image: string, 
  aspectRatio: '16:9' | '9:16' = '9:16',
  visualStyle?: string,
  globalContext?: string,
  resolution: '720p' | '1080p' = '1080p'
): Promise<string> => {
  const ai = getAI();
  
  // Refine the prompt specifically for video motion
  const imagineResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a cinematic motion directive for this scene: "${prompt}". 
    The style is ${visualStyle} and world context is ${globalContext}.
    Describe specifically the camera movement and character motion. Provide 2 sentences max.`,
    config: { thinkingConfig: { thinkingBudget: 4000 } }
  });

  const imaginedPrompt = imagineResponse.text || prompt;
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview',
    prompt: imaginedPrompt,
    image: {
      imageBytes: base64Image.split(',')[1],
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: resolution,
      aspectRatio: aspectRatio
    }
  });

  // Long polling for video completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 15000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed: No URI returned.");

  const videoResponse = await fetch(`${downloadLink}&key=${import.meta.env.VITE_API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
}

/**
 * Synthesizes speech for a script.
 */
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

  alert("Calling Gemini Pro model...");
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

// Utils for audio context decoding
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

