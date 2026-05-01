
export enum ProjectStatus {
  IDLE = 'IDLE',
  GENERATING_STORYBOARD = 'GENERATING_STORYBOARD',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  BULK_GENERATING_IMAGES = 'BULK_GENERATING_IMAGES',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  GROK_BRIDGE = 'GROK_BRIDGE',
  GENERATING_NARRATION = 'GENERATING_NARRATION',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum RenderingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED'
}

export interface ExportSettings {
  resolution: '720p' | '1080p' | '4K';
  fps: 24 | 30 | 60;
  format: 'mp4' | 'webm';
  bitrate: 'standard' | 'high' | 'prores';
  includeSubtitles: boolean;
}

export interface AudioClip {
  id: string;
  content: string;
  startTime: number;
  duration: number;
  type: 'sfx' | 'music' | 'voice';
  audioUrl?: string;
}

export type Frame = {
  id: string
  index: number
  prompt?: string
  imageUrl?: string
  videoUrl?: string
  options?: string[]
  duration: number
  type: 'ai' | 'stock'
}

export interface Clip {
  id: string
  index: number
  frames: Frame[]
  duration?: number
}

export interface Scene {
  id: string;
  order: number;
  mediaType: 'ai' | 'stock';

  aiPrompt?: string;
  startFramePrompt?: string;
  targetFramePrompt?: string;
  videoPrompt?: string;

  stockQuery?: string;

  startImageUrl?: string;
  targetImageUrl?: string;
  videoUrl?: string;

  referenceFrameUrl?: string;

  frames: Frame[];
  clips?: Clip[];

  characterIds?: string[];
  environmentId?: string;

  narrationChunk?: string;
  narrationAudioUrl?: string;

  duration?: number;
  narrationDuration?: number;

  status: 'empty' | 'generating' | 'ready' | 'error';

  sfxPrompt?: string;
  motionSensitivity?: number;

  // ── ADDED: KnowIt3D shot type hint ──
  // Comes from generateKnowIt scene data.
  // Tells promptBuilder which of the 5 shot types
  // this scene should use (type-a through type-e),
  // which determines the character state (1–4).
  // Optional so non-KnowIt scenes are unaffected.
  shotTypeHint?: string;

  // ── ADDED: scale label for KnowIt3D body section ──
  // Marks whether this scene is EXTERNAL, ORGAN, or CELLULAR
  // so the prompt builder assigns the right visual detail level.
  scaleLabel?: string;
}

export interface CaptionConfig {
  fontFamily: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
  showBackground: boolean;
  isUppercase: boolean;
  showCaptions: boolean;
  animationType: string;
  textEffect: string;
}

export interface AudioConfig {
  musicVibe: string;
  musicVolume: number;
  sfxIntensity: number;
  duckingEnabled: boolean;
  engagementSfx: boolean;
}

export interface VoiceSettings {
  speed: 'slow' | 'normal' | 'fast';
  energy: 'low' | 'normal' | 'high';
}

export interface CharacterProfile {
  id: string;
  identityTag?: string;
  name: string;
  description: string;
  appearance: {
    gender?: string;
    age?: string;
    ethnicity?: string;
    face?: string;
    hair?: string;
    eyes?: string;
    facialHair?: string;
  };
  clothing?: string;
  accessories?: string;
  referenceImage?: string;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  description: string;
  lighting?: string;
  weather?: string;
  timeOfDay?: string;
  atmosphere?: string;
}

export interface Project {
  id: string;
  title: string;
  channel: string;

  // ── ADDED: channelId ──
  // Stored directly on the project so every subsystem
  // (promptBuilder, geminiService, App.tsx UI) can read
  // which channel this project belongs to without passing
  // it separately through every function call.
  // 'knowit' triggers the KnowIt3D character system.
  // All other values fall back to generic behavior.
  channelId?: string;

  characters?: CharacterProfile[];
  environments?: EnvironmentProfile[];
  scenes: Scene[];
  extraTracks: AudioClip[][];
  backgroundMusicVibe: string;
  narrationScript: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  resolution: '720p' | '1080p';
  sceneDuration: number;
  targetTotalDuration: number;
  storyArc?: string;
  globalContext?: string;
  visualStyle?: string;
  captionConfig: CaptionConfig;
  audioConfig: AudioConfig;
  narratorVoice: string;
  voiceSettings: VoiceSettings;
}

export type VideoMode = 'velocity' | 'cinematic';

export interface ChannelIdea {
  id: string;
  channel: string;
  title: string;
  tag: string;
  suggestedMode: VideoMode;
  createdAt: number;
}

export interface IdeaBatch {
  batchId: string;
  createdAt: string;
  ideas: ChannelIdea[];
}
