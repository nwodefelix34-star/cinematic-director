
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

export type MediaShot = {
  id: string
  prompt?: string
  imageUrl?: string
  videoUrl?: string
  duration: number
}

export interface Scene {
  id: string;
  aiPrompt: string;
stockQuery: string;
  enhancedPrompt?: string;
  narrationChunk?: string;
  narrationAudioUrl?: string;
  media: MediaShot[]
  duration?: number;
  narrationDuration?: number;
  status: 'empty' | 'generating' | 'ready' | 'error';
  sfxPrompt?: string; 
  motionSensitivity?: number; // 0-100 for camera movement intensity
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
  textEffect: string; // 'none', 'shadow', 'glow', 'outline'
}

export interface AudioConfig {
  musicVibe: string;
  musicVolume: number;
  sfxIntensity: number;
  duckingEnabled: boolean;
  engagementSfx: boolean; // Auto-place 'pop' and 'whoosh' sounds
}

export interface VoiceSettings {
  speed: 'slow' | 'normal' | 'fast';
  energy: 'low' | 'normal' | 'high';
}

export interface Project {
  id: string;
  title: string;
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
  channel: string;        // mindforge, cosmora, etc
  title: string;
  tag: string;            // psychology, space, mystery etc
  suggestedMode: VideoMode;
  createdAt: number;
}

interface IdeaBatch {
  batchId: string;
  createdAt: string;
  ideas: ChannelIdea[];
}
