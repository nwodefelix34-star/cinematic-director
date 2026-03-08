
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Scene, 
  Project, 
  ProjectStatus, 
  CaptionConfig, 
  VoiceSettings, 
  AudioClip, 
  AudioConfig, 
  ExportSettings, 
  RenderingStatus,
  ChannelIdea,
  IdeaBatch,
  VideoMode
} from './types';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import Timeline from './components/Timeline';
import { 
  enhancePrompt, 
  generateNarration,
  generateStoryboard,
  generateFutureLifeStory,
  generateKnowIt,
  decodeBase64,
  decodeAudioData,
  generateImage,
  generateVideo,
  generateCustomStyle,
  generateIdeas
} from './services/geminiService';
import { generateIdeaList } from "./engine/ideaEngine";
import {
  buildStoryboard,
  buildFutureLifeStoryboard,
  buildKnowItStoryboard
} from "./engine/storyboardEngine";
import { buildImage, buildVideo, fetchStockImages } from "./engine/mediaEngine";
import { analyzeStockPrompt } from "./engine/promptAnalyzer";

const AVAILABLE_FONTS = [
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Oswald', value: "'Oswald', sans-serif" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { name: 'Bangers', value: "'Bangers', cursive" },
  { name: 'Press Start 2P', value: "'Press Start 2P', cursive" },
  { name: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
  { name: 'Permanent Marker', value: "'Permanent Marker', cursive" },
  { name: 'Righteous', value: "'Righteous', cursive" }
];

const PRESET_STYLES = [
  { name: 'zachdfilms (3D)', icon: 'fa-cube', value: 'zachdfilms signature 3D animation style, clean character models, expressive and educational lighting, smooth surfaces, high-end educational animation aesthetic' },
  { name: 'Imagine Cinematic', icon: 'fa-clapperboard', value: 'Hyper-realistic cinematic 3D style, premium textures, volumetric lighting, vibrant and expressive models' },
  { name: 'Studio Ghibli', icon: 'fa-leaf', value: 'Studio Ghibli hand-drawn anime style, lush painterly backgrounds, emotive characters' },
  { name: 'Neon Cyberpunk', icon: 'fa-bolt', value: 'Cyberpunk digital art, neon-drenched, high contrast, futuristic aesthetic' },
  { name: 'Claymation', icon: 'fa-hand-back-fist', value: 'Stop-motion claymation style, tactile clay textures, fingerprints visible, charming handcrafted feel, vibrant colors' },
  { name: 'Retro Pixel', icon: 'fa-gamepad', value: '16-bit retro pixel art style, vibrant pixel colors, nostalgic video game aesthetic, sharp pixels' },
  { name: 'Paper Cutout', icon: 'fa-scissors', value: 'Paper cutout art' }
];

const NARRATOR_VOICES = [
  { name: 'zachdfilms (Signature)', value: 'Puck', desc: 'Energetic, Educational & Informative (Male)' },
  { name: 'Grave Narrator', value: 'Fenrir', desc: 'Powerful, Deep & Grave (Male)' },
  { name: 'Warm Guide', value: 'Zephyr', desc: 'Balanced, Friendly & Warm' },
  { name: 'Soft Mystery', value: 'Charon', desc: 'Enigmatic, Calm & Soft' },
  { name: 'Youthful Energy', value: 'Kore', desc: 'Vibrant, Bright & High-Energy' }
];

const VOICE_TONES = [
  { name: 'Professional', value: 'Professional, articulate, and clear' },
  { name: 'Excited', value: 'High-energy, viral, and enthusiastic' },
  { name: 'Funny', value: 'Comedic, lighthearted, and playful' },
  { name: 'Dramatic', value: 'Serious, intense, and cinematic' },
  { name: 'Whisper', value: 'Soft, mysterious, and intimate' }
];

const TEXT_EFFECTS = [
  { name: 'None', value: 'none' },
  { name: 'Shadow', value: 'shadow' },
  { name: 'Glow', value: 'glow' },
  { name: 'Outline', value: 'outline' }
];

const ENTRANCE_ANIMATIONS = [
  { name: 'Fade', value: 'fade' },
  { name: 'Slide Up', value: 'slideUp' },
  { name: 'Zoom', value: 'zoomIn' },
  { name: 'Bounce', value: 'bounce' },
  { name: 'Blur', value: 'blurIn' }
];

type AppTab = 'story' | 'style' | 'visuals' | 'text' | 'voice' | 'score' | 'foley';

type ChannelType = 'stock' | 'ai';


interface ChannelDefinition {
  id: string;
  name: string;
  category: string;
   icon: string;
  primaryType: ChannelType; // stock or ai
  defaultMode: VideoMode;   // velocity or cinematic
}

const CHANNELS: ChannelDefinition[] = [
  {
    id: 'mindforged',
    name: 'MindForged',
    category: 'Philosophy & Psychology',
    icon: 'fa-brain',
    primaryType: 'stock',
    defaultMode: 'velocity'
  },
  {
    id: 'cosmora',
    name: 'Cosmora',
    category: 'Space & Science',
    icon: 'fa-meteor',
    primaryType: 'stock',
    defaultMode: 'cinematic'
  },
  {
    id: 'veiltheory',
    name: 'VeilTheory',
    category: 'Mystery & Conspiracy',
    icon: 'fa-eye',
    primaryType: 'stock',
    defaultMode: 'cinematic'
  },
  {
    id: 'futurelife',
    name: 'Future Life Story',
    category: 'AI Life Simulation',
    icon: 'fa-robot',
    primaryType: 'ai',
    defaultMode: 'cinematic'
  },
  {
    id: 'knowit',
    name: 'Know It',
    category: 'Educational Facts',
    icon: 'fa-lightbulb',
    primaryType: 'ai',
    defaultMode: 'velocity'
  }
];

const App: React.FC = () => {
  
  // ======================
// APP MODE SYSTEM
// ======================
const [appMode, setAppMode] =
useState<'channels' | 'ideas' | 'editor'>('channels');
  useEffect(() => {
  console.log("APP MODE CHANGED:", appMode);
}, [appMode]);
  
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
console.log("APP MODE:", appMode);
  const hasKey = true;
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(ProjectStatus.IDLE);
  const [autoTopic, setAutoTopic] = useState('');
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // 🔥 Channel + Mode System
const [selectedChannelId, setSelectedChannelId] = useState<string>('mindforged');
  const [mediaMode, setMediaMode] = useState<'stock' | 'ai'>('ai');

  const [imageProvider, setImageProvider] =
useState<'gemini' | 'flow' | 'wix'>('gemini');
  
  useEffect(() => {
  const channel = CHANNELS.find(c => c.id === selectedChannelId);
  if (!channel) return;

  // Set default video mode
  setVideoMode(channel.defaultMode);

  // Set default media mode (stock or ai)
  setMediaMode(channel.primaryType);

  // Apply pacing based on mode
  if (channel.defaultMode === 'velocity') {
    setProject(prev => ({
      ...prev,
      sceneDuration: 4
    }));
  } else {
    setProject(prev => ({
      ...prev,
      sceneDuration: 6
    }));
  }

}, [selectedChannelId]);
const [videoMode, setVideoMode] = useState<VideoMode>('velocity');
  
  const [activeTab, setActiveTab] = useState<AppTab>('story');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isTimelineMinimized, setIsTimelineMinimized] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isBrainstormingStyle, setIsBrainstormingStyle] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);

  const [ideaTopic, setIdeaTopic] = useState('');
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  
  // 🔥 Persistent Ideas Per Channel
  const [savedIdeas, setSavedIdeas] = useState<Record<string, IdeaBatch[]>>({});
  const [ideasLoaded, setIdeasLoaded] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  
  const [isGrokStudioOpen, setIsGrokStudioOpen] = useState(false);
  const [grokImportUrl, setGrokImportUrl] = useState('');
  const [grokBridgeStatus, setGrokBridgeStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');

  const [timelineHeight, setTimelineHeight] = useState(160);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const dragStartYRef = useRef(0);
  const startHeightRef = useRef(0);

  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [renderingStatus, setRenderingStatus] = useState<RenderingStatus>(RenderingStatus.IDLE);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderMessage, setRenderMessage] = useState('');
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: '1080p',
    fps: 30,
    format: 'mp4',
    bitrate: 'high',
    includeSubtitles: true
  });

  const [project, setProject] = useState<Project>({
    id: 'proj-' + Date.now(),
    title: 'Cinematic Visual Studio',
    channel: "default",
    scenes: [{
  id: 'sc-1',

  mediaType: 'ai',

  aiPrompt: '',
  startFramePrompt: '',
  targetFramePrompt: '',
  videoPrompt: '',

  stockQuery: '',

  startImageUrl: '',
  targetImageUrl: '',
  videoUrl: '',

  mediaShots: [],

  status: 'empty',
  duration: 5,
  narrationDuration: 5
}],
extraTracks: [[], []],
    backgroundMusicVibe: 'Playful, Educational, Upbeat',
    narrationScript: '',
    aspectRatio: '9:16',
    resolution: '1080p',
    sceneDuration: 5,
    targetTotalDuration: 30,
    globalContext: '',
    visualStyle: PRESET_STYLES[0].value, 
    narratorVoice: 'zachdfilms (Signature)',
    voiceSettings: { speed: 'normal', energy: 'high' },
    captionConfig: {
      fontFamily: "'Montserrat', sans-serif",
      fontSize: '48', 
      color: '#ffffff',
      backgroundColor: '#000000b3',
      showBackground: true,
      isUppercase: true,
      showCaptions: true,
      animationType: 'fade',
      textEffect: 'shadow'
    },
    audioConfig: {
      musicVibe: 'Playful Upbeat',
      musicVolume: 40,
      sfxIntensity: 60,
      duckingEnabled: true,
      engagementSfx: true
    }
  });

  const [historyPast, setHistoryPast] = useState<Project[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Project[]>([]);
  const projectRef = useRef<Project>(project);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const saveToHistory = useCallback(() => {
    setHistoryPast(prev => {
      const newPast = [...prev, projectRef.current];
      if (newPast.length > 50) return newPast.slice(1);
      return newPast;
    });
    setHistoryFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, historyPast.length - 1);
    setHistoryFuture(prev => [projectRef.current, ...prev]);
    setHistoryPast(newPast);
    setProject(previous);
  }, [historyPast]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    setHistoryPast(prev => [...prev, projectRef.current]);
    setHistoryFuture(newFuture);
    setProject(next);
  }, [historyFuture]);

  const [activeSceneId, setActiveSceneId] = useState<string>('sc-1');
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  const activeScene = project.scenes.find(s => s.id === activeSceneId) || project.scenes[0];
  const firstShot = activeScene.mediaShots?.[0];
  const visualDuration = project.scenes.reduce((acc, s) => acc + (s.duration || project.sceneDuration), 0);
  const audioDuration = project.scenes.reduce((acc, s) => acc + (s.narrationDuration || s.duration || project.sceneDuration), 0);
  const maxExtraTrackLength = project.extraTracks.reduce((max, track) => {
    const trackEnd = track.reduce((acc, clip) => Math.max(acc, clip.startTime + clip.duration), 0);
    return Math.max(max, trackEnd);
  }, 0);
  const totalLength = Math.max(visualDuration, audioDuration, maxExtraTrackLength, 0.1);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
  };

  const getAudioBuffer = async (url: string): Promise<AudioBuffer | null> => {
    if (audioBuffersRef.current.has(url)) return audioBuffersRef.current.get(url)!;
    const ctx = initAudioContext();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      let audioBuffer: AudioBuffer;
      if (url.startsWith('data:audio/pcm')) {
        const uint8 = new Uint8Array(arrayBuffer);
        audioBuffer = await decodeAudioData(uint8, ctx, 24000, 1);
      } else {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      }
      audioBuffersRef.current.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) { return null; }
  };

  const scheduleAudioPlayback = async (startTime: number) => {
    stopAllAudio();
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    let accumulatedTime = 0;
    for (const scene of project.scenes) {
      const sceneDur = scene.duration || project.sceneDuration;
      const narrDur = scene.narrationDuration || sceneDur;
      if (scene.narrationAudioUrl && (accumulatedTime + narrDur > startTime)) {
        const buffer = await getAudioBuffer(scene.narrationAudioUrl);
        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          const offset = Math.max(0, startTime - accumulatedTime);
          const playAt = Math.max(0, accumulatedTime - startTime);
          const remainingDur = buffer.duration - offset;
          if (remainingDur > 0) {
            source.start(now + playAt, offset, remainingDur);
            activeSourcesRef.current.add(source);
          }
        }
      }
      accumulatedTime += sceneDur;
    }
    for (let trackIdx = 0; trackIdx < project.extraTracks.length; trackIdx++) {
      const track = project.extraTracks[trackIdx];
      for (const clip of track) {
        if (clip.audioUrl && (clip.startTime + clip.duration > startTime)) {
          const buffer = await getAudioBuffer(clip.audioUrl);
          if (buffer) {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gainNode = ctx.createGain();
            gainNode.gain.value = (trackIdx === 0 ? project.audioConfig.musicVolume : project.audioConfig.sfxIntensity) / 100;
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            const offset = Math.max(0, startTime - clip.startTime);
            const playAt = Math.max(0, clip.startTime - startTime);
            const remainingDur = Math.min(clip.duration - offset, buffer.duration - offset);
            if (remainingDur > 0) {
              source.start(now + playAt, offset, remainingDur);
              activeSourcesRef.current.add(source);
            }
          }
        }
      }
    }
  };

  const updateActiveSceneFromTime = useCallback((time: number) => {
    let accumulated = 0;
    for (let i = 0; i < project.scenes.length; i++) {
      const dur = project.scenes[i].duration || project.sceneDuration;
      if (time <= accumulated + dur) {
        if (activeSceneId !== project.scenes[i].id) setActiveSceneId(project.scenes[i].id);
        break;
      }
      accumulated += dur;
    }
  }, [project.scenes, project.sceneDuration, activeSceneId]);

  
  useEffect(() => {
  const stored = localStorage.getItem('channelIdeas');

  if (!stored) {
    setIdeasLoaded(true);
    return;
  }

  try {
    const parsed = JSON.parse(stored);

    // 🔥 Validate structure
    const isValidStructure = Object.values(parsed).every(
      (channel: any) =>
        Array.isArray(channel) &&
        channel.every(
          (batch: any) =>
            batch.batchId &&
            batch.createdAt &&
            Array.isArray(batch.ideas)
        )
    );

    if (isValidStructure) {
      setSavedIdeas(parsed);
    } else {
      console.warn("Old idea format detected. Resetting...");
      localStorage.removeItem('channelIdeas');
      setSavedIdeas({});
    }
  } catch (err) {
    console.warn("Corrupted idea storage. Resetting...");
    localStorage.removeItem('channelIdeas');
    setSavedIdeas({});
  }

  setIdeasLoaded(true);
}, []);
      
  useEffect(() => {
  if (Object.keys(savedIdeas).length === 0) return;
  localStorage.setItem('channelIdeas', JSON.stringify(savedIdeas));
}, [savedIdeas]);
  
  useEffect(() => {
    let frameId: number;
    let startTimestamp: number;
    if (isPlayingSequence) {
      initAudioContext();
      scheduleAudioPlayback(currentTime);
      startTimestamp = Date.now() - (currentTime * 1000);
      const step = () => {
        const elapsed = (Date.now() - startTimestamp) / 1000;
        if (elapsed >= totalLength) {
          setIsPlayingSequence(false);
          stopAllAudio();
          setCurrentTime(0);
          updateActiveSceneFromTime(0);
          return;
        }
        setCurrentTime(elapsed);
        updateActiveSceneFromTime(elapsed);
        frameId = requestAnimationFrame(step);
      };
      frameId = requestAnimationFrame(step);
    } else { stopAllAudio(); }
    return () => { cancelAnimationFrame(frameId); stopAllAudio(); };
  }, [isPlayingSequence, totalLength, updateActiveSceneFromTime]);

  const handleSeek = (time: number) => {
    const newTime = Math.max(0, Math.min(totalLength, time));
    setCurrentTime(newTime);
    updateActiveSceneFromTime(newTime);
    if (isPlayingSequence) scheduleAudioPlayback(newTime);
  };

  const playRawPcm = async (url: string) => {
    const ctx = initAudioContext();
    stopAllAudio();
    try {
      const buffer = await getAudioBuffer(url);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      activeSourcesRef.current.add(source);
    } catch (err) {}
  };

  const updateScene = (id: string, updates: Partial<Scene>, saveHistory: boolean = false) => {
    if (saveHistory) saveToHistory();
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const handleRemoveScene = (id: string) => {
    saveToHistory();
    setProject(p => {
      if (p.scenes.length <= 1) return p;
      const newScenes = p.scenes.filter(s => s.id !== id);
      if (activeSceneId === id) setActiveSceneId(newScenes[0].id);
      return { ...p, scenes: newScenes };
    });
  };

  const handleGenerateIdeaList = async () => {

  alert("CLICK WORKS");

  setIsGeneratingIdeas(true);

  try {

  // 🔵 Collect previous ideas for this channel
  const existingIdeas = (savedIdeas[selectedChannelId] || [])
    .flatMap(batch => batch.ideas.map(i => i.title))
    .slice(0, 50);

  // 🔵 Generate new ideas
  const ideas = await generateIdeaList(
  ideaTopic,
  selectedChannelId,
  existingIdeas
);

  setGeneratedIdeas(ideas);

  const newIdeas: ChannelIdea[] = ideas.map((idea) => ({
    id: 'idea-' + Date.now() + '-' + Math.random(),
    channel: selectedChannelId,
    title: idea,
    tag: ideaTopic,
    suggestedMode: videoMode,
    createdAt: Date.now()
  }));

    const newBatch = {
  batchId: Date.now().toString(),
  createdAt: new Date().toISOString(),
  ideas: newIdeas
};

setSavedIdeas(prev => ({
  ...prev,
  [selectedChannelId]: [
    newBatch,
    ...(prev[selectedChannelId] || [])
  ]
}));

  } catch (err) {
    console.error("Idea generation failed", err);
  } finally {
    setIsGeneratingIdeas(false);
  }
};

  const handleAutoStoryboard = async () => {
  alert("handleAutoStoryboard started");
    if (!autoTopic) return;
    saveToHistory();
    setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);
    try {
      const numScenes = Math.max(1, Math.ceil(project.targetTotalDuration / project.sceneDuration));
   
  const result = await buildStoryboard(
  autoTopic,
  selectedChannelId,
  project.aspectRatio === '9:16',
  numScenes
);
      const channelPacing = {
  mindforged: { first: 0.75, last: 1.25 },
  cosmora: { first: 0.85, last: 1.3 },
  veiltheory: { first: 0.9, last: 1.35 },
  futurelife: { first: 0.85, last: 1.25 },
  knowit: { first: 0.7, last: 1.1 }
};

const pacing = channelPacing[selectedChannelId as keyof typeof channelPacing] 
  || { first: 0.8, last: 1.2 };
      
      const newScenes: Scene[] = result.scenes.map((s, idx) => {
        const baseDuration = project.sceneDuration;
let calculatedDuration = baseDuration;

if (idx === 0) {
  calculatedDuration = baseDuration * pacing.first;
} else if (idx === result.scenes.length - 1) {
  calculatedDuration = baseDuration * pacing.last;
}
        
        return {
        id: `sc-auto-${idx}-${Date.now()}`,
        aiPrompt: s.aiPrompt,
stockQuery: s.stockQuery,
        narrationChunk: s.narration,
        status: 'ready',
          duration: calculatedDuration,
  narrationDuration: calculatedDuration,
        sfxPrompt: s.sfx
};
});
      setProject(prev => ({ 
        ...prev, 
        title: result.title, 
        globalContext: result.globalContext,
        visualStyle: result.visualStyle,
        scenes: newScenes 
      }));
      setActiveSceneId(newScenes[0].id);
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err: any) { 
      console.error("Storyboard generation failed:", err);
      alert("REAL ERROR: " + (err?.message || JSON.stringify(err)));
      setProjectStatus(ProjectStatus.ERROR);
      setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
    }
  };
  
  const handleFutureLifeStoryStoryboard = async () => {
  alert("Future Life Story started");

  if (!autoTopic) return;

  saveToHistory();
  setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);

  try {
    const numScenes = Math.max(1, Math.ceil(project.targetTotalDuration / project.sceneDuration));

    const result = await buildFutureLifeStoryboard(
      autoTopic,
      project.aspectRatio === '9:16',
      numScenes
    );

    const newScenes: Scene[] = result.scenes.map((s, idx): Scene => ({
      id: `sc-future-${idx}-${Date.now()}`,
      prompt: s.prompt,
      narrationChunk: s.narration,
      status: 'ready',
      duration: project.sceneDuration,
      narrationDuration: project.sceneDuration,
      sfxPrompt: s.sfx
    }));

    setProject(prev => ({
      ...prev,
      title: result.title,
      globalContext: result.globalContext,
      visualStyle: result.visualStyle,
      scenes: newScenes
    }));

    setActiveSceneId(newScenes[0].id);
    setProjectStatus(ProjectStatus.IDLE);

  } catch (err: any) {
    console.error("Future Life Story failed:", err);
    alert("REAL ERROR: " + (err?.message || JSON.stringify(err)));
    setProjectStatus(ProjectStatus.ERROR);
    setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
  }
};

  const handleKnowItStoryboard = async () => {
  alert("KnowIt started");

  if (!autoTopic) return;

  saveToHistory();
  setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);

  try {
    const numScenes = Math.max(
      1,
      Math.ceil(project.targetTotalDuration / project.sceneDuration)
    );

    const result = await buildKnowItStoryboard(
      autoTopic,
      project.aspectRatio === '9:16',
      numScenes
    );

    const newScenes: Scene[] = result.scenes.map((s, idx): Scene => ({
      id: `sc-knowit-${idx}-${Date.now()}`,
      prompt: s.prompt,
      narrationChunk: s.narration,
      status: 'ready',
      duration: project.sceneDuration,
      narrationDuration: project.sceneDuration,
      sfxPrompt: s.sfx
    }));

    setProject(prev => ({
      ...prev,
      title: result.title,
      globalContext: result.globalContext,
      visualStyle: result.visualStyle,
      scenes: newScenes
    }));

    setActiveSceneId(newScenes[0].id);
    setProjectStatus(ProjectStatus.IDLE);

  } catch (err: any) {
    console.error("KnowIt failed:", err);
    alert("REAL ERROR: " + (err?.message || JSON.stringify(err)));
    setProjectStatus(ProjectStatus.ERROR);
    setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
  }
};

  const handleGenerateImage = async (id: string) => {
  const scene = project.scenes.find(s => s.id === id);

  if (!scene) {
    alert("Scene not found");
    return;
  }

  const activePrompt =
  scene.mediaType === 'stock'
    ? scene.stockQuery
    : scene.aiPrompt;

  if (!activePrompt || activePrompt.trim() === "") {
    alert("Prompt is empty");
    return;
  }

  setProjectStatus(ProjectStatus.GENERATING_IMAGE);

  try {

    // STOCK MODE
if (mediaMode === 'stock') {

  const shots = analyzeStockPrompt(scene.stockQuery)

  const newShots = []

  for (const shot of shots) {

    const images = await fetchStockImages(shot.prompt)

    if (images.length > 0) {
      newShots.push({
        id: shot.id,
        prompt: shot.prompt,
        imageUrl: images[0].url,
        duration: scene.duration || project.sceneDuration
      })
    }

  }

  updateScene(id, {
    mediaShots: newShots,
    status: 'ready'
  })

  setProjectStatus(ProjectStatus.IDLE)

  return
}

    // AI MODE
    let imageUrl = "";

if (imageProvider === "gemini") {
  imageUrl = await buildImage(
    activePrompt,
    project.aspectRatio as any,
    project.globalContext,
    project.visualStyle
  );
}

if (imageProvider === "flow") {
  alert("Flow generation coming soon");
  return;
}

if (imageProvider === "wix") {
  alert("Wix generation coming soon");
  return;
}
    
    const newShot = {
  id: 'shot-' + Date.now(),
  imageUrl: imageUrl,
  duration: project.sceneDuration
};

setProject(prev => ({
  ...prev,
  scenes: prev.scenes.map(scene =>
    scene.id === id
      ? {
          ...scene,
          media: [...scene.media, newShot],
          status: 'ready'
        }
      : scene
  )
}));
    setProjectStatus(ProjectStatus.IDLE);

  } catch (err: any) {
    console.error("Image generation failed:", err);
    alert("REAL ERROR: " + (err?.message || "Unknown error"));
    setProjectStatus(ProjectStatus.ERROR);
    setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
  }
};

  const handleGenerateVideo = async (id: string) => {
  const s = project.scenes.find(sc => sc.id === id);
  if (!s || s.media.length === 0) return;

  const lastShot = s.media[s.media.length - 1];

  if (!lastShot.imageUrl) return;

  setProjectStatus(ProjectStatus.GENERATING_VIDEO);

  try {
    const url = await generateVideo(
      s.aiPrompt,
      lastShot.imageUrl,
      project.aspectRatio as any,
      project.visualStyle,
      project.globalContext,
      project.resolution
    );

    const updatedMedia = s.media.map(shot =>
      shot.id === lastShot.id
        ? { ...shot, videoUrl: url }
        : shot
    );

    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.id === id
          ? { ...scene, media: updatedMedia, status: 'ready' }
          : scene
      )
    }));

    setProjectStatus(ProjectStatus.IDLE);

  } catch (err) {
    setProjectStatus(ProjectStatus.ERROR);
  }
};

  const handleGrokBridgeGeneration = async () => {
    if (!activeScene.imageUrl) return;
    setGrokBridgeStatus('generating');
    setProjectStatus(ProjectStatus.GROK_BRIDGE);
    try {
      const url = await generateVideo(`Cinematic Studio Motion: ${activeScene.prompt}`, activeScene.imageUrl, project.aspectRatio as any, `${project.visualStyle}, Cinema Grade`, project.globalContext, '1080p');
      updateScene(activeSceneId, { videoUrl: url, status: 'ready' }, true);
      setGrokBridgeStatus('ready');
      setIsGrokStudioOpen(false);
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err) { setGrokBridgeStatus('error'); setProjectStatus(ProjectStatus.ERROR); }
  };

  const handleEnhancePromptAction = async () => {
    if (!activeScene.prompt) return;
    setIsEnhancingPrompt(true);
    try {
      const enhanced = await enhancePrompt(activeScene.prompt);
      updateScene(activeSceneId, { prompt: enhanced }, true);
    } catch (err) {} finally { setIsEnhancingPrompt(false); }
  };

  const handleBrainstormStyle = async () => {
    setIsBrainstormingStyle(true);
    try {
      const style = await generateCustomStyle(autoTopic || "Educational 3D Animation", project.globalContext || "");
      saveToHistory();
      setProject(prev => ({ ...prev, visualStyle: style }));
    } catch (err) {} finally { setIsBrainstormingStyle(false); }
  };

  const handleBakeNarration = async (id: string) => {
  const s = project.scenes.find(sc => sc.id === id);
  if (!s || !s.narrationChunk) return;

  setProjectStatus(ProjectStatus.GENERATING_NARRATION);

  try {
    const voice = NARRATOR_VOICES.find(v => v.name === project.narratorVoice) || NARRATOR_VOICES[0];

    const base64 = await generateNarration(
  s.narrationChunk,
  voice.value,
  project.narrationScript,
  project.voiceSettings.speed,
  project.voiceSettings.energy
);

const audioUrl = `data:audio/pcm;base64,${base64}`;

const ctx = new AudioContext();
const rawBytes = decodeBase64(base64);

// Gemini TTS = 24000 Hz, mono
const audioBuffer = await decodeAudioData(
  rawBytes,
  ctx,
  24000,
  1
);

const duration = audioBuffer.duration;

updateScene(id, {
  narrationAudioUrl: audioUrl,
  narrationDuration: duration,
  duration: duration
}, true);

setProjectStatus(ProjectStatus.IDLE);
    } catch (err) {
    setProjectStatus(ProjectStatus.ERROR);
  }
};

  const handlePreviewVoice = async (voiceName: string, voiceValue: string) => {
    setIsPreviewingVoice(voiceName);
    try {
      const base64 = await generateNarration("This is a sample of the " + voiceName + " voice model.", voiceValue, project.narrationScript, project.voiceSettings.speed, project.voiceSettings.energy);
      await playRawPcm(`data:audio/pcm;base64,${base64}`);
    } catch (err) {
      console.error("Voice preview failed:", err);
    } finally {
      setIsPreviewingVoice(null);
    }
  };

  const handleBakeMusicScore = async () => {
    setProjectStatus(ProjectStatus.GENERATING_NARRATION);
    try {
      const base64 = await generateNarration("... ... background beat ... atmosphere ...", "Zephyr", `Rhythmic background for ${project.audioConfig.musicVibe}`);
      const url = `data:audio/pcm;base64,${base64}`;
      const newClip: AudioClip = {
        id: 'music-' + Date.now(),
        content: `Score: ${project.audioConfig.musicVibe}`,
        startTime: 0,
        duration: totalLength,
        type: 'music',
        audioUrl: url
      };
      saveToHistory();
      setProject(prev => {
        const newTracks = [...prev.extraTracks];
        newTracks[0] = [newClip];
        return { ...prev, extraTracks: newTracks };
      });
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err) { setProjectStatus(ProjectStatus.ERROR); }
  };

  const handleBakeSFX = async () => {
    if (!activeScene.sfxPrompt) return;
    setProjectStatus(ProjectStatus.GENERATING_NARRATION);
    try {
      const base64 = await generateNarration(activeScene.sfxPrompt, "Fenrir", "High-quality foley SFX");
      const url = `data:audio/pcm;base64,${base64}`;
      const newClip: AudioClip = {
        id: 'sfx-' + Date.now(),
        content: activeScene.sfxPrompt,
        startTime: currentTime,
        duration: 3,
        type: 'sfx',
        audioUrl: url
      };
      saveToHistory();
      setProject(prev => {
        const newTracks = [...prev.extraTracks];
        newTracks[1] = [...newTracks[1], newClip];
        return { ...prev, extraTracks: newTracks };
      });
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err) { setProjectStatus(ProjectStatus.ERROR); }
  };

  const updateGlobalAudioClip = (trackIndex: number, clipId: string, updates: Partial<AudioClip>, finalize: boolean = false) => {
    if (finalize) saveToHistory();
    setProject(prev => {
      const newTracks = [...prev.extraTracks];
      newTracks[trackIndex] = newTracks[trackIndex].map(c => c.id === clipId ? { ...c, ...updates } : c);
      return { ...prev, extraTracks: newTracks };
    });
  };

  const addGlobalAudioClip = (trackIndex: number, startTime: number) => {
    saveToHistory();
    const newClip: AudioClip = {
      id: 'clip-' + Date.now(),
      content: trackIndex === 0 ? 'Score Layer' : 'FX Layer',
      startTime,
      duration: 5,
      type: trackIndex === 0 ? 'music' : 'sfx'
    };
    setProject(prev => {
      const newTracks = [...prev.extraTracks];
      newTracks[trackIndex] = [...newTracks[trackIndex], newClip];
      return { ...prev, extraTracks: newTracks };
    });
  };

  const removeGlobalAudioClip = (trackIndex: number, clipId: string) => {
    saveToHistory();
    setProject(prev => {
      const newTracks = [...prev.extraTracks];
      newTracks[trackIndex] = newTracks[trackIndex].filter(c => c.id !== clipId);
      return { ...prev, extraTracks: newTracks };
    });
  };

  const handleTabClick = (tab: AppTab) => {
    if (activeTab === tab) {
      setIsPanelCollapsed(!isPanelCollapsed);
    } else {
      setActiveTab(tab);
      setIsPanelCollapsed(false);
    }
  };

  const handleResizeTimelineStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTimeline(true);
    dragStartYRef.current = e.clientY;
    startHeightRef.current = timelineHeight;
    window.addEventListener('mousemove', handleResizeTimelineMove);
    window.addEventListener('mouseup', handleResizeTimelineEnd);
  };

  const handleResizeTimelineMove = (e: MouseEvent) => {
    const delta = dragStartYRef.current - e.clientY;
    const newHeight = Math.max(32, Math.min(window.innerHeight - 200, startHeightRef.current + delta));
    setTimelineHeight(newHeight);
    if (newHeight > 40 && isTimelineMinimized) setIsTimelineMinimized(false);
    else if (newHeight <= 40 && !isTimelineMinimized) setIsTimelineMinimized(true);
  };

  const handleResizeTimelineEnd = () => {
    setIsResizingTimeline(false);
    window.removeEventListener('mousemove', handleResizeTimelineMove);
    window.removeEventListener('mouseup', handleResizeTimelineEnd);
  };

  const handleToggleMinimize = () => {
    setIsTimelineMinimized(!isTimelineMinimized);
    setTimelineHeight(isTimelineMinimized ? 160 : 32);
  };

  const handleStartRender = async () => {
    setRenderingStatus(RenderingStatus.PROCESSING);
    setRenderProgress(0);
    const stages = ["Sequencing...", "Mixing...", "Exporting..."];
    for (let i = 0; i < stages.length; i++) {
      setRenderMessage(stages[i]);
      for (let j = 0; j < 33; j++) {
        setRenderProgress(p => Math.min(100, p + 1));
        await new Promise(r => setTimeout(r, 30));
      }
    }
    setRenderingStatus(RenderingStatus.FINISHED);
    setRenderMessage("Complete.");
  };

  const updateCaptionConfig = (updates: Partial<CaptionConfig>) => {
    saveToHistory();
    setProject(prev => ({ ...prev, captionConfig: { ...prev.captionConfig, ...updates } }));
  };

  const updateVoiceSettings = (updates: Partial<VoiceSettings>) => {
    saveToHistory();
    setProject(prev => ({ ...prev, voiceSettings: { ...prev.voiceSettings, ...updates } }));
  };

  // ======================
// CHANNEL DASHBOARD
// ======================
if (appMode === 'channels') {
  return (
    <div className="h-screen w-screen bg-[#050507] text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-xl font-black uppercase tracking-widest">Select Channel</h1>

      <div className="grid grid-cols-1 gap-4 w-80">
        {CHANNELS.map(channel => (
          <button
  key={channel.id}
  onClick={() => {
    setSelectedChannelId(channel.id);
    setVideoMode(channel.defaultMode);
    setAppMode('ideas');
  }}
  className={`
    p-5 rounded-2xl border transition-all text-left
    ${channel.primaryType === 'ai'
      ? 'bg-[#14141c] border-purple-500/30 hover:border-purple-400 hover:shadow-purple-500/20'
      : 'bg-[#14141c] border-cyan-500/20 hover:border-cyan-400 hover:shadow-cyan-400/20'
    }
    hover:shadow-lg
  `}
>
  <div className="flex items-center gap-3 mb-2">
    <div
      className={`
        w-8 h-8 rounded-lg flex items-center justify-center
        ${channel.primaryType === 'ai'
          ? 'bg-purple-500/20 text-purple-400'
          : 'bg-cyan-500/20 text-cyan-400'
        }
      `}
    >
      <i className={`fas ${channel.icon} text-xs`} />
    </div>

    <div className="text-sm font-bold text-white">
      {channel.name}
    </div>
  </div>

  <div className="text-[11px] text-slate-400 uppercase tracking-wide">
    {channel.category} — {channel.primaryType === 'ai' ? 'AI Channel' : 'Stock Channel'}
  </div>
</button>
        ))}
      </div>
    </div>
  );
}

// ======================
// IDEA SCREEN
// ======================
if (appMode === 'ideas') {

  const channelIdeas = savedIdeas[selectedChannelId] || [];

  return (
    <div className="h-screen w-screen bg-[#050507] text-white flex flex-col p-8 gap-6">

      <h1 className="text-xl font-black uppercase tracking-widest">
        {CHANNELS.find(c => c.id === selectedChannelId)?.name}
      </h1>

      {/* Generate New Ideas */}
      <div className="flex gap-4">
        <input
          value={ideaTopic}
          onChange={(e) => setIdeaTopic(e.target.value)}
          placeholder="Enter topic..."
          className="flex-1 bg-[#14141c] border border-white/10 rounded-xl px-4 py-3 text-sm"
        />

        <button
          onClick={handleGenerateIdeaList}
          className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold"
        >
          Generate
        </button>
      </div>

      {/* Idea List */}
      <div className="flex flex-col gap-3 mt-4">
        {channelIdeas.length === 0 && (
          <div className="text-slate-500 text-sm">
            No ideas yet. Generate one above.
          </div>
        )}

        {channelIdeas.map((batch) => {
  const isOpen = expandedBatch === batch.batchId;

  return (
    <div
      key={batch.batchId}
      className="bg-[#14141c] border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Batch Header */}
      <button
        onClick={() =>
          setExpandedBatch(isOpen ? null : batch.batchId)
        }
        className="w-full p-4 text-left flex justify-between items-center hover:bg-white/5 transition-all"
      >
        <div>
          <div className="font-bold text-sm">
            Generated {batch.ideas.length} Ideas
          </div>
          <div className="text-xs text-slate-500">
            {new Date(batch.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="text-xs">
          {isOpen ? "▲" : "▼"}
        </div>
      </button>

      {/* Expand Section */}
      {isOpen && (
        <div className="flex flex-col border-t border-white/10">
          {batch.ideas.map((idea) => (
            <button
              key={idea.id}
              onClick={() => {
                setAutoTopic(idea.title);
                setAppMode('editor');
              }}
              className="p-3 text-left hover:bg-cyan-500/10 text-sm"
            >
              {idea.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
})}
      </div>

      <button
        onClick={() => setAppMode('channels')}
        className="text-slate-500 text-xs mt-6"
      >
        Back to Channels
      </button>

    </div>
  );
}

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[#050507] text-[#f1f5f9] font-inter ${isResizingTimeline ? 'cursor-row-resize' : ''}`}>
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0f] shrink-0 z-50 shadow-lg">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 via-cyan-400 to-blue-500 flex items-center justify-center shadow-lg"><i className="fas fa-cube text-white text-sm"></i></div>
          <input value={project.title} onFocus={() => saveToHistory()} onChange={(e) => setProject({...project, title: e.target.value})} className="text-xs font-black uppercase tracking-widest bg-transparent border-none outline-none text-slate-400 focus:text-white" />
        </div>
        <button onClick={() => { setIsRenderModalOpen(true); setRenderingStatus(RenderingStatus.IDLE); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest">Render</button>
      </header>

      {isRenderModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-lg bg-[#0c0c12] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black uppercase tracking-widest">Master Studio Render</h2>
                <button onClick={() => setIsRenderModalOpen(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
             </div>
             {renderingStatus === RenderingStatus.IDLE ? (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      {['720p', '1080p'].map(res => (
                        <button key={res} onClick={() => setExportSettings({...exportSettings, resolution: res as any})} className={`p-4 rounded-2xl border text-[10px] font-black uppercase ${exportSettings.resolution === res ? 'bg-blue-600 border-blue-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>{res}</button>
                      ))}
                   </div>
                   <button onClick={handleStartRender} className="w-full py-5 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase">Start Export</button>
                </div>
             ) : (
                <div className="space-y-8 flex flex-col items-center py-6">
                   <div className="relative w-24 h-24">
                      <svg className="w-full h-full transform -rotate-90">
                         <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                         <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - renderProgress / 100)} className="text-blue-500 transition-all duration-300" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-black">{renderProgress}%</div>
                   </div>
                   <div className="text-center space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">{renderMessage}</p>
                      {renderingStatus === RenderingStatus.FINISHED && (
                        <button onClick={() => setIsRenderModalOpen(false)} className="mt-4 px-8 py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase">Close</button>
                      )}
                   </div>
                </div>
             )}
          </div>
        </div>
      )}

      {isGrokStudioOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
           <div className="w-full max-w-2xl bg-[#0c0c12] border border-white/10 rounded-[2.5rem] p-12 shadow-2xl relative animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black uppercase tracking-widest">Grok Studio Bridge</h2>
                 <button onClick={() => setIsGrokStudioOpen(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="aspect-video rounded-2xl bg-black border border-white/5 overflow-hidden shadow-inner">
                    {activeScene.imageUrl ? <img src={activeScene.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-800"><i className="fas fa-camera text-4xl"></i></div>}
                 </div>
                 <div className="space-y-6">
                    <button onClick={handleGrokBridgeGeneration} disabled={grokBridgeStatus === 'generating' || !activeScene.imageUrl} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 active:scale-95 disabled:opacity-20 transition-all shadow-lg shadow-blue-500/20">
                       {grokBridgeStatus === 'generating' ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-bolt-lightning"></i>}
                       Generate via Studio Bridge
                    </button>
                    <div className="border-t border-white/5 pt-6 space-y-3">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Manual URL Import</label>
                       <div className="flex gap-2">
                          <input value={grokImportUrl} onChange={(e) => setGrokImportUrl(e.target.value)} placeholder="Paste MP4 link..." className="flex-1 bg-black border border-white/5 rounded-xl px-4 py-3 text-[10px] outline-none" />
                          <button onClick={() => { if(grokImportUrl){ updateScene(activeSceneId, { videoUrl: grokImportUrl, status: 'ready' }, true); setIsGrokStudioOpen(false); setGrokImportUrl(''); } }} className="px-6 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase">Import</button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <aside className="w-14 border-r border-white/5 bg-[#0a0a0f] flex flex-col shrink-0 z-40">
          <div className="flex-1 flex flex-col items-center py-6 gap-6 overflow-y-auto no-scrollbar">
            {(['story', 'style', 'visuals', 'text', 'voice', 'score', 'foley'] as AppTab[]).map((tab) => (
              <button key={tab} onClick={() => handleTabClick(tab)} className={`p-2 rounded-lg transition-all ${activeTab === tab && !isPanelCollapsed ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}><i className={`fas fa-${tab === 'story' ? 'wand-magic-sparkles' : tab === 'style' ? 'palette' : tab === 'visuals' ? 'clapperboard' : tab === 'text' ? 'font' : tab === 'voice' ? 'microphone-lines' : tab === 'score' ? 'music' : 'bolt-lightning'} text-xs`}></i></button>
            ))}
          </div>
          <button onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="pb-4 text-slate-800 hover:text-white transition-colors"><i className={`fas fa-chevron-${isPanelCollapsed ? 'right' : 'left'} text-[10px]`}></i></button>
        </aside>

        <div className={`absolute top-0 bottom-0 left-14 h-full transition-all duration-300 border-r border-white/5 bg-[#0c0c12]/95 backdrop-blur-2xl flex flex-col overflow-hidden z-[60] shadow-2xl ${isPanelCollapsed ? 'w-0 opacity-0' : 'w-72 opacity-100'}`}>
          <div className="p-5 flex flex-col h-full gap-6 overflow-y-auto custom-scroll min-w-[18rem]">

            {activeTab === 'story' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-cyan-400">Story Architect</h3>
                <textarea value={autoTopic} onChange={(e) => setAutoTopic(e.target.value)} className="w-full h-32 bg-[#14141c] border border-white/5 rounded-xl p-4 text-xs outline-none resize-none" placeholder="Enter video topic..." />
                <button onClick={handleAutoStoryboard} disabled={projectStatus === ProjectStatus.GENERATING_STORYBOARD} className="w-full py-4 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase">{projectStatus === ProjectStatus.GENERATING_STORYBOARD ? 'Building...' : 'Synthesize Script'}</button>
                
              </div>
            )}
            {activeTab === 'style' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-cyan-400">Visual Aesthetic</h3>
                <textarea value={project.visualStyle} onChange={(e) => setProject({...project, visualStyle: e.target.value})} className="w-full h-32 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[10px] outline-none resize-none" />
                <button onClick={handleBrainstormStyle} disabled={isBrainstormingStyle} className="w-full py-3 bg-white/5 text-[9px] font-black uppercase rounded-xl border border-white/10">{isBrainstormingStyle ? 'Thinking...' : 'AI Brainstorm'}</button>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_STYLES.map(s => (
                    <button key={s.name} onClick={() => setProject({...project, visualStyle: s.value})} className="p-3 bg-[#14141c] border border-white/5 rounded-xl text-[8px] font-black uppercase hover:bg-cyan-500/10 text-center transition-all">{s.name}</button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'visuals' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-cyan-400">Scene Directing</h3>
                <textarea
  value={
    mediaMode === 'stock'
      ? activeScene.stockQuery
      : activeScene.aiPrompt
  }
  onChange={(e) =>
    updateScene(
      activeSceneId,
      mediaMode === 'stock'
        ? { stockQuery: e.target.value }
        : { aiPrompt: e.target.value }
    )
  }
  className="w-full h-32 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[10px] outline-none resize-none"
/>
                <button onClick={handleEnhancePromptAction} disabled={isEnhancingPrompt} className="w-full py-3 bg-white/5 text-[9px] font-black uppercase rounded-xl border border-white/10">{isEnhancingPrompt ? 'Enhancing...' : 'Enhance Directive'}</button>
                <div className="space-y-3">
  <div className="flex gap-2">
    <button
      onClick={() => setMediaMode('ai')}
      className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase border ${
        mediaMode === 'ai'
          ? 'bg-cyan-500 text-black border-cyan-500'
          : 'bg-[#14141c] border-white/5 text-slate-500'
      }`}
    >
      AI Mode
    </button>

    <button
      onClick={() => setMediaMode('stock')}
      className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase border ${
        mediaMode === 'stock'
          ? 'bg-amber-500 text-black border-amber-500'
          : 'bg-[#14141c] border-white/5 text-slate-500'
      }`}
    >
      Stock Mode
    </button>
  </div>

                  {mediaMode === 'ai' && (
  <div className="grid grid-cols-3 gap-2">

    <button
      onClick={() => setImageProvider('gemini')}
      className={`py-2 rounded-lg text-[8px] font-black uppercase border ${
        imageProvider === 'gemini'
          ? 'bg-purple-500 text-black border-purple-500'
          : 'bg-[#14141c] border-white/5 text-slate-500'
      }`}
    >
      Gemini
    </button>

    <button
      onClick={() => setImageProvider('flow')}
      className={`py-2 rounded-lg text-[8px] font-black uppercase border ${
        imageProvider === 'flow'
          ? 'bg-blue-500 text-black border-blue-500'
          : 'bg-[#14141c] border-white/5 text-slate-500'
      }`}
    >
      Flow
    </button>

    <button
      onClick={() => setImageProvider('wix')}
      className={`py-2 rounded-lg text-[8px] font-black uppercase border ${
        imageProvider === 'wix'
          ? 'bg-pink-500 text-black border-pink-500'
          : 'bg-[#14141c] border-white/5 text-slate-500'
      }`}
    >
      Wix
    </button>

  </div>
)}

  <button
    onClick={() => handleGenerateImage(activeSceneId)}
    className="w-full py-4 bg-white text-black rounded-xl text-[9px] font-black uppercase transition-all shadow-lg"
  >
    {mediaMode === 'ai' ? 'Generate AI Frame' : 'Load Stock Frame'}
  </button>
</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleGenerateVideo(activeSceneId)} disabled={!activeScene.imageUrl} className="py-4 bg-cyan-500 text-black rounded-xl text-[9px] font-black uppercase disabled:opacity-20 shadow-lg shadow-cyan-400/10">Veo Motion</button>
                  <button onClick={() => setIsGrokStudioOpen(true)} disabled={!activeScene.imageUrl} className="py-4 bg-black text-white rounded-xl text-[9px] font-black uppercase border border-white/10 hover:bg-slate-900 disabled:opacity-20">Grok Imagine</button>
                </div>
              </div>
            )}
            {activeTab === 'text' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-amber-500">Typography Suite</h3>
                <div className="space-y-3">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Text</label>
                    <textarea value={activeScene.narrationChunk || ''} onChange={(e) => updateScene(activeSceneId, {narrationChunk: e.target.value})} className="w-full h-24 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[11px] outline-none" />
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/5">
                   <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => updateCaptionConfig({showCaptions: !project.captionConfig.showCaptions})} className={`py-3 rounded-xl text-[8px] font-black uppercase border ${project.captionConfig.showCaptions ? 'bg-amber-500 text-black' : 'bg-[#14141c] text-slate-500'}`}>Show Text</button>
                      <button onClick={() => updateCaptionConfig({isUppercase: !project.captionConfig.isUppercase})} className={`py-3 rounded-xl text-[8px] font-black uppercase border ${project.captionConfig.isUppercase ? 'bg-amber-500 text-black' : 'bg-[#14141c] text-slate-500'}`}>Uppercase</button>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Font Family</label>
                      <select value={project.captionConfig.fontFamily} onChange={(e) => updateCaptionConfig({fontFamily: e.target.value})} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                         {AVAILABLE_FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                      </select>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between items-center">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Font Size</label>
                         <span className="text-[8px] font-black text-amber-500">{project.captionConfig.fontSize}px</span>
                      </div>
                      <input type="range" min="3" max="120" value={parseInt(project.captionConfig.fontSize)} onChange={(e) => updateCaptionConfig({fontSize: e.target.value})} className="w-full h-1 bg-white/10 appearance-none accent-amber-500 rounded-full" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Text Color</label>
                         <input type="color" value={project.captionConfig.color} onChange={(e) => updateCaptionConfig({color: e.target.value})} className="w-full h-10 bg-[#14141c] border border-white/5 rounded-xl outline-none cursor-pointer" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">BG Color</label>
                         <input type="color" value={project.captionConfig.backgroundColor.slice(0, 7)} onChange={(e) => updateCaptionConfig({backgroundColor: e.target.value + 'b3'})} className="w-full h-10 bg-[#14141c] border border-white/5 rounded-xl outline-none cursor-pointer" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entrance Animation</label>
                      <select value={project.captionConfig.animationType} onChange={(e) => updateCaptionConfig({animationType: e.target.value})} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                         {ENTRANCE_ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.name}</option>)}
                      </select>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Text Effect</label>
                      <select value={project.captionConfig.textEffect} onChange={(e) => updateCaptionConfig({textEffect: e.target.value})} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                         {TEXT_EFFECTS.map(eff => <option key={eff.value} value={eff.value}>{eff.name}</option>)}
                      </select>
                   </div>
                </div>
              </div>
            )}
            {activeTab === 'voice' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Narrator Engine</h3>
                <div className="space-y-3">
                  {NARRATOR_VOICES.map(v => (
                    <div key={v.name} className="flex gap-2">
                      <button 
                        onClick={() => setProject({...project, narratorVoice: v.name})} 
                        className={`flex-1 p-4 rounded-xl text-[9px] font-black uppercase text-left border transition-all ${project.narratorVoice === v.name ? 'bg-amber-500 text-black border-amber-500 shadow-md' : 'bg-[#14141c] border-white/5 text-slate-500 hover:border-white/10'}`}
                      >
                        <div>{v.name}</div>
                        <div className="text-[7px] opacity-60 font-medium">{v.desc}</div>
                      </button>
                      <button 
                        onClick={() => handlePreviewVoice(v.name, v.value)} 
                        disabled={isPreviewingVoice !== null}
                        className={`w-12 rounded-xl border border-white/5 bg-[#14141c] flex items-center justify-center text-slate-500 hover:text-white transition-all ${isPreviewingVoice === v.name ? 'animate-pulse text-amber-500 border-amber-500/50' : ''}`}
                      >
                        {isPreviewingVoice === v.name ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-play"></i>}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                   <div className="space-y-3">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Narrator Speed</label>
                      <div className="grid grid-cols-3 gap-2">
                         {(['slow', 'normal', 'fast'] as const).map(s => (
                           <button 
                             key={s} 
                             onClick={() => updateVoiceSettings({speed: s})} 
                             className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${project.voiceSettings.speed === s ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}
                           >
                             {s}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Energy Level</label>
                      <div className="grid grid-cols-3 gap-2">
                         {(['low', 'normal', 'high'] as const).map(e => (
                           <button 
                             key={e} 
                             onClick={() => updateVoiceSettings({energy: e})} 
                             className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${project.voiceSettings.energy === e ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}
                           >
                             {e}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Delivery Tone</label>
                      <select 
                        value={project.narrationScript} 
                        onChange={(e) => setProject({...project, narrationScript: e.target.value})} 
                        className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none focus:border-amber-500"
                      >
                         {VOICE_TONES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
                      </select>
                   </div>
                </div>

                <button onClick={() => handleBakeNarration(activeSceneId)} className="w-full py-4 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 transition-all active:scale-95">Synthesize Script</button>
              </div>
            )}
            {activeTab === 'score' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Music Bed</h3>
                <input value={project.audioConfig.musicVibe} onChange={(e) => setProject({...project, audioConfig: {...project.audioConfig, musicVibe: e.target.value}})} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-4 text-xs outline-none" placeholder="Atmospheric, Upbeat..." />
                
                <div className="p-4 bg-[#14141c] border border-white/5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black uppercase text-slate-400">Audio Ducking</span>
                     <button 
                        onClick={() => setProject({...project, audioConfig: {...project.audioConfig, duckingEnabled: !project.audioConfig.duckingEnabled}})}
                        className={`w-10 h-5 rounded-full relative transition-all ${project.audioConfig.duckingEnabled ? 'bg-blue-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${project.audioConfig.duckingEnabled ? 'right-1' : 'left-1'}`}></div>
                     </button>
                  </div>
                  <p className="text-[7px] text-slate-600 uppercase font-bold leading-relaxed">Automatically lowers music volume when the narrator is speaking.</p>
                </div>

                <button onClick={handleBakeMusicScore} className="w-full py-4 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20">Generate Music Bed</button>
                <div className="space-y-2">
                   <div className="flex justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      <span>Volume</span>
                      <span>{project.audioConfig.musicVolume}%</span>
                   </div>
                   <input type="range" min="0" max="100" value={project.audioConfig.musicVolume} onChange={(e) => setProject({...project, audioConfig: {...project.audioConfig, musicVolume: parseInt(e.target.value)}})} className="w-full h-1 bg-white/10 appearance-none accent-blue-500 rounded-full" />
                </div>
              </div>
            )}
            {activeTab === 'foley' && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sound FX</h3>
                <textarea value={activeScene.sfxPrompt || ''} onChange={(e) => updateScene(activeSceneId, {sfxPrompt: e.target.value})} className="w-full h-24 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[11px] outline-none" placeholder="Sound of a laser impact..." />
                
                <div className="p-4 bg-[#14141c] border border-white/5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black uppercase text-slate-400">Engagement FX</span>
                     <button 
                        onClick={() => setProject({...project, audioConfig: {...project.audioConfig, engagementSfx: !project.audioConfig.engagementSfx}})}
                        className={`w-10 h-5 rounded-full relative transition-all ${project.audioConfig.engagementSfx ? 'bg-cyan-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${project.audioConfig.engagementSfx ? 'right-1' : 'left-1'}`}></div>
                     </button>
                  </div>
                  <p className="text-[7px] text-slate-600 uppercase font-bold leading-relaxed">Auto-places transitions and emphasis pops for viral retention.</p>
                </div>

                <button onClick={handleBakeSFX} disabled={!activeScene.sfxPrompt} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase disabled:opacity-20 transition-all border border-white/10">Bake Scene FX</button>
                <div className="space-y-2">
                   <div className="flex justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      <span>SFX Intensity</span>
                      <span>{project.audioConfig.sfxIntensity}%</span>
                   </div>
                   <input type="range" min="0" max="100" value={project.audioConfig.sfxIntensity} onChange={(e) => setProject({...project, audioConfig: {...project.audioConfig, sfxIntensity: parseInt(e.target.value)}})} className="w-full h-1 bg-white/10 appearance-none accent-slate-500 rounded-full" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-[#050507] relative flex flex-col items-center justify-center p-4 overflow-hidden z-10">
          <div className="flex flex-col items-center w-full h-full">
            <div className={`relative flex-1 bg-black shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 rounded-2xl overflow-hidden flex flex-col transition-all duration-700 max-h-full max-w-full ${project.aspectRatio === '9:16' ? 'aspect-[9/16] h-full w-auto' : 'aspect-video w-full h-auto max-w-5xl'}`}>
               <div className="flex-1 relative overflow-hidden flex items-center justify-center">

{firstShot?.videoUrl ? (
  <video src={firstShot.videoUrl} className="w-full h-full object-contain" autoPlay loop muted />
) : firstShot?.imageUrl ? (
  <img src={firstShot.imageUrl} className="w-full h-full object-cover" />
) : (
  <div className="opacity-5 animate-pulse text-[80px] flex flex-col items-center gap-4">
    <i className="fas fa-cube"></i>
    <span className="text-[10px] font-black uppercase tracking-[1em]">Director Monitor</span>
  </div>
)}
                 
                  {project.captionConfig.showCaptions && activeScene.narrationChunk && (
                     <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center pointer-events-none z-20">
                        <div className={`px-8 py-3 rounded-2xl text-center font-black transition-all border border-white/5 backdrop-blur-md animate-text-${project.captionConfig.animationType}`} style={{ 
                           fontFamily: project.captionConfig.fontFamily, 
                           color: project.captionConfig.color, 
                           backgroundColor: project.captionConfig.showBackground ? project.captionConfig.backgroundColor : 'transparent', 
                           fontSize: `clamp(2px, 4vw, ${parseInt(project.captionConfig.fontSize)/2}px)`, 
                           textTransform: project.captionConfig.isUppercase ? 'uppercase' : 'none', 
                           textShadow: project.captionConfig.textEffect === 'shadow' ? '2px 2px 8px rgba(0,0,0,0.8)' : project.captionConfig.textEffect === 'glow' ? `0 0 12px ${project.captionConfig.color}` : 'none' 
                        }}>{activeScene.narrationChunk}</div>
                     </div>
                  )}

                  {projectStatus !== ProjectStatus.IDLE && (
                     <div className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-3xl z-50 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(34,211,238,0.2)]"></div>
                        <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">{projectStatus.replace(/_/g, ' ')}</span>
                     </div>
                  )}
               </div>
            </div>

            <div className="w-full max-w-lg px-4 mt-6 z-50">
               <div className="flex flex-col gap-3 bg-[#0a0a0f]/98 backdrop-blur-3xl px-6 py-4 rounded-3xl border border-white/10 shadow-2xl">
                 <input type="range" min="0" max={totalLength} step="0.01" value={currentTime} onChange={(e) => handleSeek(parseFloat(e.target.value))} className="w-full h-1 appearance-none cursor-pointer accent-cyan-400 bg-white/10 rounded-full" />
                 <div className="flex items-center justify-between">
                   <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-4">
                        <button onClick={() => handleSeek(currentTime - 5)} className="text-slate-600 hover:text-white transition-all active:scale-90"><i className="fas fa-backward-step"></i></button>
                        <button onClick={() => setIsPlayingSequence(!isPlayingSequence)} className="w-12 h-12 bg-cyan-400 text-black rounded-full flex items-center justify-center shadow-lg shadow-cyan-400/20 hover:scale-105 active:scale-95 transition-all"><i className={`fas ${isPlayingSequence ? 'fa-pause' : 'fa-play'} text-lg`}></i></button>
                        <button onClick={() => handleSeek(currentTime + 5)} className="text-slate-600 hover:text-white transition-all active:scale-90"><i className="fas fa-backward-step"></i></button>
                      </div>
                      <div className="flex items-center gap-4 opacity-60">
                         <button onClick={handleUndo} disabled={historyPast.length === 0} className={`flex items-center gap-1.5 transition-all ${historyPast.length > 0 ? 'text-slate-400 hover:text-white' : 'text-slate-800 pointer-events-none'}`}><i className="fas fa-rotate-left text-[10px]"></i><span className="text-[7px] font-black uppercase tracking-widest">Undo</span></button>
                         <button onClick={handleRedo} disabled={historyFuture.length === 0} className={`flex items-center gap-1.5 transition-all ${historyFuture.length > 0 ? 'text-slate-400 hover:text-white' : 'text-slate-800 pointer-events-none'}`}><span className="text-[7px] font-black uppercase tracking-widest">Redo</span><i className="fas fa-rotate-right text-[10px]"></i></button>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-mono font-black text-cyan-400">{currentTime.toFixed(2)}s</span>
                      <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">/ {totalLength.toFixed(1)}s Master</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      <div 
        onMouseDown={handleResizeTimelineStart} 
        onClick={(e) => { if (!isResizingTimeline) handleToggleMinimize(); }} 
        className={`h-4 w-full bg-[#0a0a0f] hover:bg-cyan-400/20 cursor-row-resize transition-all flex items-center justify-center group z-50 shrink-0 border-t border-b border-white/5 active:bg-cyan-500/20 ${isResizingTimeline ? 'bg-cyan-400/30' : ''}`}
        title="Drag to resize or Click to toggle timeline visibility"
      >
        <div className={`w-12 h-1 rounded-full bg-white/10 group-hover:bg-cyan-400/60 transition-all ${isResizingTimeline ? 'bg-cyan-400 w-20 h-1.5' : ''}`}></div>
      </div>

      <footer className="bg-[#08080c] z-40 shrink-0 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)]" style={{ height: timelineHeight }}>
        <Timeline 
           scenes={project.scenes} 
           extraTracks={project.extraTracks} 
           activeSceneId={activeSceneId} 
           onSelectScene={setActiveSceneId} 
           onAddScene={() => { saveToHistory(); setProject(p => ({...p, scenes: [...p.scenes, 
  {
  id: 'sc-' + Date.now(),

  mediaType: 'ai',

  aiPrompt: '',
  startFramePrompt: '',
  targetFramePrompt: '',
  videoPrompt: '',

  stockQuery: '',

  startImageUrl: '',
  targetImageUrl: '',
  videoUrl: '',

mediaShots: [],

  narrationChunk: '',
  status: 'ready',
  duration: project.sceneDuration,
  narrationDuration: project.sceneDuration,
  sfxPrompt: ''
  }
           ]
            }));
          }} 
           onRemoveScene={handleRemoveScene} 
           onUpdateSceneDuration={(id, dur) => updateScene(id, {duration: dur})} 
           onUpdateNarrationDuration={(id, dur) => updateScene(id, {narrationDuration: dur})} 
           onUpdateGlobalClip={updateGlobalAudioClip} 
           onAddGlobalClip={addGlobalAudioClip} 
           onRemoveGlobalClip={removeGlobalAudioClip} 
           onPreviewNarration={playRawPcm} 
           onBakeNarration={handleBakeNarration} 
           onMinimize={handleToggleMinimize} 
           isMinimized={isTimelineMinimized} 
           defaultDuration={project.sceneDuration} 
           totalProjectDuration={totalLength} 
           currentTime={currentTime} 
           onSeek={handleSeek} 
        />
      </footer>
    </div>
  );
};

export default App;
