import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scene, Project, ProjectStatus, CaptionConfig, VoiceSettings,
  AudioClip, ExportSettings, RenderingStatus, ChannelIdea, IdeaBatch, VideoMode
} from './types';
import Timeline from './components/Timeline';
import {
  enhancePrompt, generateNarration, generateStoryboard,
  generateFutureLifeStory, generateKnowIt, decodeBase64,
  decodeAudioData, generateImage, buildBridgePrompts,
  generateCustomStyle, generateIdeas
} from './services/geminiService';
import { generateIdeaList } from "./engine/ideaEngine";
import { buildStoryboard, buildFutureLifeStoryboard, buildKnowItStoryboard } from "./engine/storyboardEngine";
import { buildImage } from "./engine/mediaEngine";
import { generateSceneImage } from "./controllers/mediaController";
import { generateSceneVideo } from "./controllers/mediaController";
import { analyzeEntities } from "./engine/entityAnalyzer";
import { mapCharactersToScenes } from "./engine/sceneCharacterMapper";

// ─────────────────────────────────────────────────────────────
// PLATFORM DETECTION
// The same React code runs in three environments:
//   1. Web / Vercel  → normal browser, modals + window.open
//   2. Electron      → desktop app, real embedded browser panel
//   3. Capacitor     → Android / iOS app, in-app browser sheet
// ─────────────────────────────────────────────────────────────

// ── Electron (desktop) ───────────────────────────────────────
declare global {
  interface Window {
    electronAPI?: {
      isElectron:               true;
      openBridge:               (url: string) => Promise<{ ok: boolean }>;
      hideBridge:               ()            => Promise<{ ok: boolean }>;
      goBack:                   ()            => Promise<void>;
      goForward:                ()            => Promise<void>;
      reload:                   ()            => Promise<void>;
      onDownload:               (cb: (data: { filename: string; mimeType: string; base64: string }) => void) => void;
      onNavigated:              (cb: (url: string) => void) => void;
      removeAllBridgeListeners: ()            => void;
    };
  }
}

// ── Capacitor (Android / iOS) ─────────────────────────────────
const isCapacitorApp = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-IMPORT: scans phone storage for the newest image/video after browser closes
// Uses @capacitor/filesystem which registers as window.Capacitor.Plugins.Filesystem
// ─────────────────────────────────────────────────────────────────────────────
const autoImportNewestFile = async (
  type: 'image' | 'video',
  onSuccess: (dataUrl: string, mimeType: string) => void,
  onFail: () => void,
) => {
  try {
    const Filesystem = (window as any).Capacitor?.Plugins?.Filesystem;
    if (!Filesystem) { onFail(); return; }

    // Folders where ImageFX and Hunyuan save files on Android
    const folders = type === 'image'
      ? ['Pictures', 'Pictures/ImageFX', 'Pictures/Flow', 'Download']
      : ['Movies', 'Download', 'DCIM/Camera'];

    const cutoff = Date.now() - 90_000; // files saved in last 90 seconds
    const exts   = type === 'image' ? ['.jpg', '.jpeg', '.png', '.webp'] : ['.mp4', '.mov', '.webm'];

    let newest: { path: string; mtime: number; mime: string } | null = null;

    for (const folder of folders) {
      try {
        const { files } = await Filesystem.readdir({
          path: folder,
          directory: 'EXTERNAL_STORAGE',
        });
        for (const f of (files || [])) {
          const name: string = typeof f === 'string' ? f : f.name;
          const mtime: number = typeof f === 'object' ? (f.mtime || 0) : 0;
          if (!exts.some(e => name.toLowerCase().endsWith(e))) continue;
          if (mtime < cutoff && mtime !== 0) continue;
          if (!newest || mtime > newest.mtime) {
            newest = {
              path: folder + '/' + name,
              mtime,
              mime: name.endsWith('.png') ? 'image/png'
                  : name.endsWith('.webp') ? 'image/webp'
                  : name.endsWith('.mp4') ? 'video/mp4'
                  : name.endsWith('.mov') ? 'video/quicktime'
                  : 'image/jpeg',
            };
          }
        }
      } catch { /* folder may not exist — skip */ }
    }

    if (!newest) { onFail(); return; }

    const { data } = await Filesystem.readFile({
      path: newest.path,
      directory: 'EXTERNAL_STORAGE',
    });
    const dataUrl = `data:${newest.mime};base64,${data}`;
    onSuccess(dataUrl, newest.mime);
  } catch { onFail(); }
};

// ─────────────────────────────────────────────────────────────────────────────
// scanFilesLibrary — reads phone storage and returns all media files
// sorted newest-first. Called when user opens the Files panel.
// ─────────────────────────────────────────────────────────────────────────────
const scanFilesLibrary = async (): Promise<Array<{
  id: string; path: string; name: string; dataUrl: string;
  mime: string; mtime: number; type: 'image' | 'video';
}>> => {
  const Filesystem = (window as any).Capacitor?.Plugins?.Filesystem;
  if (!Filesystem) return [];

  const folders = ['Pictures', 'Pictures/ImageFX', 'Pictures/Flow', 'Download', 'Movies', 'DCIM/Camera'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const videoExts = ['.mp4', '.mov', '.webm'];
  const results: any[] = [];

  for (const folder of folders) {
    try {
      const { files } = await Filesystem.readdir({ path: folder, directory: 'EXTERNAL_STORAGE' });
      for (const f of (files || [])) {
        const name: string = typeof f === 'string' ? f : f.name;
        const mtime: number = typeof f === 'object' ? (f.mtime || Date.now()) : Date.now();
        const isImage = imageExts.some(e => name.toLowerCase().endsWith(e));
        const isVideo = videoExts.some(e => name.toLowerCase().endsWith(e));
        if (!isImage && !isVideo) continue;
        const mime = name.endsWith('.png') ? 'image/png'
                   : name.endsWith('.webp') ? 'image/webp'
                   : name.endsWith('.mp4') ? 'video/mp4'
                   : name.endsWith('.mov') ? 'video/quicktime'
                   : 'image/jpeg';
        try {
          const { data } = await Filesystem.readFile({ path: folder + '/' + name, directory: 'EXTERNAL_STORAGE' });
          results.push({
            id: folder + '/' + name,
            path: folder + '/' + name,
            name,
            dataUrl: `data:${mime};base64,${data}`,
            mime,
            mtime,
            type: isVideo ? 'video' : 'image',
          });
        } catch { /* file unreadable — skip */ }
      }
    } catch { /* folder missing — skip */ }
  }

  return results.sort((a, b) => b.mtime - a.mtime).slice(0, 100); // newest 100 files
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// openCapacitorBrowser — custom native WebView browser (CineBrowser plugin).
//
// CineBrowser is our own Capacitor plugin (CineBrowserPlugin.java) that:
//   ✅ Opens a full-screen WebView with dark toolbar matching the app
//   ✅ Intercepts downloads before they hit the phone's file system
//   ✅ Saves files to the app's private /files/cine_downloads/ folder
//   ✅ Returns the file as a base64 dataUrl directly to JavaScript
//   ✅ Auto-closes the browser and imports the file into the scene
//
// Falls back to @capacitor/browser (Chrome Custom Tab) if CineBrowser
// hasn't loaded yet (first launch before plugin registers).
// ─────────────────────────────────────────────────────────────────────────────
const openCapacitorBrowser = (
  url: string,
  title: string,
  onFileDownloaded: (dataUrl: string, mimeType: string) => void,
  onClose: () => void,
): void => {
  const CineBrowser = (window as any).Capacitor?.Plugins?.CineBrowser;

  if (CineBrowser?.open) {
    // ── Our custom native plugin ──────────────────────────────────────
    CineBrowser.open({ url, title });

    CineBrowser.addListener('fileDownloaded', (result: any) => {
      onFileDownloaded(result.dataUrl, result.mimeType);
    }).catch(() => {});

    CineBrowser.addListener('browserClosed', () => {
      onClose();
    }).catch(() => {});

    return;
  }

  // ── Fallback: @capacitor/browser (Chrome Custom Tab) ─────────────────
  const CapBrowser = (window as any).Capacitor?.Plugins?.Browser;
  if (CapBrowser?.open) {
    CapBrowser.open({ url, presentationStyle: 'fullscreen', toolbarColor: '#070709' });
    CapBrowser.addListener('browserFinished', () => { onClose(); }).catch(() => {});
    return;
  }

  window.open(url, '_blank');
};


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
  { name: 'zachdfilms (3D)', value: 'zachdfilms signature 3D animation style, clean character models, expressive and educational lighting' },
  { name: 'Imagine Cinematic', value: 'Hyper-realistic cinematic 3D style, premium textures, volumetric lighting' },
  { name: 'Studio Ghibli', value: 'Studio Ghibli hand-drawn anime style, lush painterly backgrounds, emotive characters' },
  { name: 'Neon Cyberpunk', value: 'Cyberpunk digital art, neon-drenched, high contrast, futuristic aesthetic' },
  { name: 'Claymation', value: 'Stop-motion claymation style, tactile clay textures, charming handcrafted feel' },
  { name: 'Retro Pixel', value: '16-bit retro pixel art style, vibrant pixel colors, nostalgic video game aesthetic' },
  { name: 'Paper Cutout', value: 'Paper cutout art' }
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
  primaryType: ChannelType;
  defaultMode: VideoMode;
  disabled?: boolean;
}

// ── CHANNELS: KnowIt3D added as new channel, old Know It kept but disabled ──
const CHANNELS: ChannelDefinition[] = [
  { id: 'mindforged', name: 'MindForged', category: 'Philosophy & Psychology', icon: 'fa-brain', primaryType: 'stock', defaultMode: 'velocity' },
  { id: 'cosmora', name: 'Cosmora', category: 'Space & Science', icon: 'fa-meteor', primaryType: 'stock', defaultMode: 'cinematic' },
  { id: 'veiltheory', name: 'VeilTheory', category: 'Mystery & Conspiracy', icon: 'fa-eye', primaryType: 'stock', defaultMode: 'cinematic' },
  { id: 'futurelife', name: 'Future Life Story', category: 'AI Life Simulation', icon: 'fa-robot', primaryType: 'ai', defaultMode: 'cinematic' },
  { id: 'knowit3d', name: 'KnowIt3D', category: 'Body Science — AI Channel', icon: 'fa-dna', primaryType: 'ai', defaultMode: 'velocity' },
  { id: 'knowit', name: 'Know It', category: 'Educational Facts — Coming Soon', icon: 'fa-lightbulb', primaryType: 'ai', defaultMode: 'velocity', disabled: true },
];

const App: React.FC = () => {

  const [appMode, setAppMode] = useState<'channels' | 'ideas' | 'editor'>('channels');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('mindforged');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(ProjectStatus.IDLE);
  const [autoTopic, setAutoTopic] = useState('');
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaMode, setMediaMode] = useState<'stock' | 'ai'>('ai');
  const [imageProvider, setImageProvider] = useState<'gemini' | 'flow' | 'wix'>('gemini');
  const [videoMode, setVideoMode] = useState<VideoMode>('velocity');

  // ── Bridge state ─────────────────────────────────────────────
  // Shared
  const [isBridgeOpen,      setIsBridgeOpen]      = useState(false);
  const [bridgeMode,        setBridgeMode]         = useState<'flow' | 'hunyuan'>('flow');
  const [bridgeAutoImported,setBridgeAutoImported] = useState(false);
  const [bridgeCurrentUrl,  setBridgeCurrentUrl]   = useState('');
  // Flow
  const [isFlowBridgeOpen,  setIsFlowBridgeOpen]  = useState(false); // web fallback only
  const [flowBridgePrompt,  setFlowBridgePrompt]  = useState('');
  const [flowBridgeCopied,  setFlowBridgeCopied]  = useState(false);
  const [flowBridgeSceneId, setFlowBridgeSceneId] = useState<string | null>(null);
  const flowBridgeSceneIdRef = useRef<string | null>(null);
  // Keep ref in sync with state so download callbacks (closures) always see current sceneId
  useEffect(() => { flowBridgeSceneIdRef.current = flowBridgeSceneId; }, [flowBridgeSceneId]);
  // Hunyuan
  const [isHunyuanBridgeOpen,  setIsHunyuanBridgeOpen]  = useState(false); // web fallback only
  const [hunyuanBridgePrompt,  setHunyuanBridgePrompt]  = useState('');
  const [hunyuanBridgeCopied,  setHunyuanBridgeCopied]  = useState(false);
  const [hunyuanImportUrl,     setHunyuanImportUrl]      = useState('');
  // Mobile (Capacitor) — show file-picker after the in-app browser closes
  const [showMobileImport,  setShowMobileImport]  = useState(false);
  // Files tab — permanent media library panel
  const [showFilesPanel,    setShowFilesPanel]     = useState(false);
  const [filesLibrary,      setFilesLibrary]       = useState<Array<{
    id: string; path: string; name: string; dataUrl: string;
    mime: string; mtime: number; type: 'image' | 'video';
  }>>([]);
  const [isScanningFiles,   setIsScanningFiles]   = useState(false);


  const [activeTab, setActiveTab] = useState<AppTab>('story');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isTimelineMinimized, setIsTimelineMinimized] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isBrainstormingStyle, setIsBrainstormingStyle] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);
  const [ideaTopic, setIdeaTopic] = useState('');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState<Record<string, IdeaBatch[]>>({});
  const [ideasLoaded, setIdeasLoaded] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(180);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const dragStartYRef = useRef(0);
  const startHeightRef = useRef(0);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [renderingStatus, setRenderingStatus] = useState<RenderingStatus>(RenderingStatus.IDLE);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderMessage, setRenderMessage] = useState('');
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ resolution: '1080p', fps: 30, format: 'mp4', bitrate: 'high', includeSubtitles: true });
  const [timelineMode, setTimelineMode] = useState<'scene' | 'frame'>('scene');
  const [frameIndex, setFrameIndex] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [project, setProject] = useState<Project>({
    id: 'proj-' + Date.now(),
    title: 'Cinematic Visual Studio',
    channel: 'default',
    channelId: 'mindforged',
    scenes: [{
      id: 'sc-1', order: 0, mediaType: 'ai', aiPrompt: '', startFramePrompt: '',
      targetFramePrompt: '', videoPrompt: '', stockQuery: '', startImageUrl: '',
      targetImageUrl: '', videoUrl: '', frames: [], status: 'empty', duration: 5, narrationDuration: 5
    }],
    extraTracks: [[], []],
    backgroundMusicVibe: 'Playful, Educational, Upbeat',
    narrationScript: '', aspectRatio: '9:16', resolution: '1080p',
    sceneDuration: 5, targetTotalDuration: 30, globalContext: '',
    visualStyle: PRESET_STYLES[0].value, narratorVoice: 'zachdfilms (Signature)',
    voiceSettings: { speed: 'normal', energy: 'high' },
    captionConfig: {
      fontFamily: "'Montserrat', sans-serif", fontSize: '48', color: '#ffffff',
      backgroundColor: '#000000b3', showBackground: true, isUppercase: true,
      showCaptions: true, animationType: 'fade', textEffect: 'shadow'
    },
    audioConfig: { musicVibe: 'Playful Upbeat', musicVolume: 40, sfxIntensity: 60, duckingEnabled: true, engagementSfx: true }
  });

  const [historyPast, setHistoryPast] = useState<Project[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Project[]>([]);
  const projectRef = useRef<Project>(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  // ── ELECTRON: auto-import downloaded files into the active scene ──────────
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;

    window.electronAPI.onDownload(({ base64, mimeType }) => {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const proj    = projectRef.current;

      if (bridgeMode === 'flow' && flowBridgeSceneId) {
        updateScene(flowBridgeSceneId, {
          frames: [{ id: 'frame-' + Date.now(), index: 0, imageUrl: dataUrl,
                     options: [dataUrl], duration: proj.sceneDuration, type: 'ai' as const }],
          status: 'ready',
        }, true);
      } else if (bridgeMode === 'hunyuan') {
        const sid = proj.activeSceneId ?? proj.scenes[0]?.id;
        if (sid) updateScene(sid, { videoUrl: dataUrl, status: 'ready' }, true);
      }
      setBridgeAutoImported(true);
      setTimeout(() => setBridgeAutoImported(false), 5000);
    });

    window.electronAPI.onNavigated(url => setBridgeCurrentUrl(url));

    return () => window.electronAPI?.removeAllBridgeListeners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeMode, flowBridgeSceneId]);

  // ── CAPACITOR: close handling is done via onClose callback in openCapacitorBrowser ──
  // The cordova InAppBrowser fires the 'exit' event directly on the browser object.
  // The @capacitor/browser fallback fires 'browserFinished' and is handled inline.
  // No separate useEffect listener needed — removing this prevents the blank screen bug.

  const saveToHistory = useCallback(() => {
    setHistoryPast(prev => { const n = [...prev, projectRef.current]; return n.length > 50 ? n.slice(1) : n; });
    setHistoryFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (!historyPast.length) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture(f => [projectRef.current, ...f]);
    setHistoryPast(p => p.slice(0, -1));
    setProject(prev);
  }, [historyPast]);

  const handleRedo = useCallback(() => {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryPast(p => [...p, projectRef.current]);
    setHistoryFuture(f => f.slice(1));
    setProject(next);
  }, [historyFuture]);

  const [activeSceneId, setActiveSceneId] = useState<string>('sc-1');
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  const activeScene = project.scenes.find(s => s.id === activeSceneId) || project.scenes[0];
  const clipDuration = activeScene.duration || project.sceneDuration;
  const timelineMax = clipDuration * 1.5;
  const clipPercent = (clipDuration / timelineMax) * 100;

  const visualDuration = project.scenes.reduce((acc, s) => acc + (s.duration || project.sceneDuration), 0);
  const audioDuration = project.scenes.reduce((acc, s) => acc + (s.narrationDuration || s.duration || project.sceneDuration), 0);
  const maxExtraTrackLength = project.extraTracks.reduce((max, track) => {
    const end = track.reduce((acc, clip) => Math.max(acc, clip.startTime + clip.duration), 0);
    return Math.max(max, end);
  }, 0);
  const totalLength = Math.max(visualDuration, audioDuration, maxExtraTrackLength, 0.1);

  // ══════════════════════════════════════════════
  // PREVIEW — frame-accurate scrubbing
  // Gets the correct scene and frame for currentTime
  // ══════════════════════════════════════════════
  const getPreviewFrame = useCallback(() => {
    let accumulated = 0;
    for (const scene of project.scenes) {
      const dur = scene.duration || project.sceneDuration;
      if (currentTime <= accumulated + dur) {
        // Found the right scene — now find the right frame
        const sceneTime = currentTime - accumulated;
        const frames = scene.frames || [];
        if (frames.length === 0) return { scene, frame: null };
        const frameDur = dur / frames.length;
        const fIdx = Math.min(Math.floor(sceneTime / frameDur), frames.length - 1);
        return { scene, frame: frames[fIdx] || frames[0] };
      }
      accumulated += dur;
    }
    // Past the end — show last scene last frame
    const lastScene = project.scenes[project.scenes.length - 1];
    const lastFrames = lastScene.frames || [];
    return { scene: lastScene, frame: lastFrames[lastFrames.length - 1] || null };
  }, [currentTime, project.scenes, project.sceneDuration]);

  const { scene: previewScene, frame: previewFrame } = getPreviewFrame();

  // ── Get narration text synced to playhead ──
  const getPreviewNarration = useCallback(() => {
    let accumulated = 0;
    for (const scene of project.scenes) {
      const dur = scene.duration || project.sceneDuration;
      if (currentTime <= accumulated + dur) return scene.narrationChunk || '';
      accumulated += dur;
    }
    return '';
  }, [currentTime, project.scenes, project.sceneDuration]);

  const previewNarration = getPreviewNarration();

  // ── Update active scene from playhead ──
  const updateActiveSceneFromTime = useCallback((time: number) => {
    let accumulated = 0;
    for (const s of project.scenes) {
      const dur = s.duration || project.sceneDuration;
      if (time <= accumulated + dur) {
        if (activeSceneId !== s.id) setActiveSceneId(s.id);
        break;
      }
      accumulated += dur;
    }
  }, [project.scenes, project.sceneDuration, activeSceneId]);

  useEffect(() => {
    const channel = CHANNELS.find(c => c.id === selectedChannelId);
    if (!channel || channel.disabled) return;
    setVideoMode(channel.defaultMode);
    setMediaMode(channel.primaryType);
    setProject(prev => ({
      ...prev,
      channelId: selectedChannelId,
      sceneDuration: channel.defaultMode === 'velocity' ? 4 : 6
    }));
  }, [selectedChannelId]);

  // ── Frame index sync during playback ──
  useEffect(() => {
    if (!activeScene?.frames?.length) return;
    let accumulated = 0;
    for (const s of project.scenes) {
      const dur = s.duration || project.sceneDuration;
      if (s.id === activeScene.id) {
        const sceneTime = currentTime - accumulated;
        const frameDur = dur / activeScene.frames.length;
        const idx = Math.floor(sceneTime / frameDur);
        if (isPlayingSequence) setFrameIndex(Math.min(idx, activeScene.frames.length - 1));
        break;
      }
      accumulated += dur;
    }
  }, [currentTime, activeScene, project.scenes]);

  useEffect(() => {
    const stored = localStorage.getItem('channelIdeas');
    if (!stored) { setIdeasLoaded(true); return; }
    try {
      const parsed = JSON.parse(stored);
      const isValid = Object.values(parsed).every((ch: any) =>
        Array.isArray(ch) && ch.every((b: any) => b.batchId && b.createdAt && Array.isArray(b.ideas))
      );
      setSavedIdeas(isValid ? parsed : {});
      if (!isValid) localStorage.removeItem('channelIdeas');
    } catch { localStorage.removeItem('channelIdeas'); setSavedIdeas({}); }
    setIdeasLoaded(true);
  }, []);

  useEffect(() => {
    if (Object.keys(savedIdeas).length === 0) return;
    localStorage.setItem('channelIdeas', JSON.stringify(savedIdeas));
  }, [savedIdeas]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
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
    } catch { return null; }
  };

  const scheduleAudioPlayback = async (startTime: number) => {
    stopAllAudio();
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    let acc = 0;
    for (const scene of project.scenes) {
      const sceneDur = scene.duration || project.sceneDuration;
      const narrDur = scene.narrationDuration || sceneDur;
      if (scene.narrationAudioUrl && acc + narrDur > startTime) {
        const buffer = await getAudioBuffer(scene.narrationAudioUrl);
        if (buffer) {
          const src = ctx.createBufferSource();
          src.buffer = buffer; src.connect(ctx.destination);
          const offset = Math.max(0, startTime - acc);
          const playAt = Math.max(0, acc - startTime);
          const rem = buffer.duration - offset;
          if (rem > 0) { src.start(now + playAt, offset, rem); activeSourcesRef.current.add(src); }
        }
      }
      acc += sceneDur;
    }
    for (let ti = 0; ti < project.extraTracks.length; ti++) {
      for (const clip of project.extraTracks[ti]) {
        if (clip.audioUrl && clip.startTime + clip.duration > startTime) {
          const buffer = await getAudioBuffer(clip.audioUrl);
          if (buffer) {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = (ti === 0 ? project.audioConfig.musicVolume : project.audioConfig.sfxIntensity) / 100;
            src.connect(gain); gain.connect(ctx.destination);
            const offset = Math.max(0, startTime - clip.startTime);
            const playAt = Math.max(0, clip.startTime - startTime);
            const rem = Math.min(clip.duration - offset, buffer.duration - offset);
            if (rem > 0) { src.start(now + playAt, offset, rem); activeSourcesRef.current.add(src); }
          }
        }
      }
    }
  };

  useEffect(() => {
    let frameId: number;
    let startTimestamp: number;
    if (isPlayingSequence) {
      initAudioContext();
      scheduleAudioPlayback(currentTime);
      startTimestamp = Date.now() - currentTime * 1000;
      const step = () => {
        const elapsed = (Date.now() - startTimestamp) / 1000;
        if (elapsed >= totalLength) {
          setIsPlayingSequence(false); stopAllAudio(); setCurrentTime(0); updateActiveSceneFromTime(0); return;
        }
        setCurrentTime(elapsed); updateActiveSceneFromTime(elapsed);
        frameId = requestAnimationFrame(step);
      };
      frameId = requestAnimationFrame(step);
    } else { stopAllAudio(); }
    return () => { cancelAnimationFrame(frameId); stopAllAudio(); };
  }, [isPlayingSequence, totalLength, updateActiveSceneFromTime]);

  const handleSeek = (time: number) => {
    const t = Math.max(0, Math.min(totalLength, time));
    setCurrentTime(t); updateActiveSceneFromTime(t);
    if (isPlayingSequence) scheduleAudioPlayback(t);
  };

  const playRawPcm = async (url: string) => {
    const ctx = initAudioContext(); stopAllAudio();
    try {
      const buf = await getAudioBuffer(url);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination); src.start();
      activeSourcesRef.current.add(src);
    } catch {}
  };

  const updateScene = (id: string, updates: Partial<Scene>, hist = false) => {
    if (hist) saveToHistory();
    setProject(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, ...updates } : s) }));
  };

  const handleSplitClip = (sceneId: string, clipIndex: number, time: number) => {
    saveToHistory();
    setProject(prev => {
      const scene = prev.scenes.find(s => s.id === sceneId);
      if (!scene || !scene.clips) return prev;
      const clips = [...scene.clips];
      const clip = clips[clipIndex];
      if (!clip?.frames || clip.frames.length < 2) return prev;
      const mid = Math.floor(clip.frames.length / 2);
      const f1 = clip.frames.slice(0, mid);
      const f2 = clip.frames.slice(mid);
      if (!f1.length || !f2.length) return prev;
      clips.splice(clipIndex, 1, { ...clip, id: crypto.randomUUID(), frames: f1 }, { ...clip, id: crypto.randomUUID(), frames: f2 });
      return { ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, clips } : s) };
    });
  };

  const handleRemoveScene = (id: string) => {
    saveToHistory();
    setProject(p => {
      if (p.scenes.length <= 1) return p;
      const ns = p.scenes.filter(s => s.id !== id);
      if (activeSceneId === id) setActiveSceneId(ns[0].id);
      return { ...p, scenes: ns };
    });
  };

  const handleGenerateIdeaList = async () => {
    setIsGeneratingIdeas(true);
    try {
      const existing = (savedIdeas[selectedChannelId] || []).flatMap(b => b.ideas.map((i: any) => i.title)).slice(0, 50);
      const ideas = await generateIdeaList(ideaTopic, selectedChannelId, existing);
      const newIdeas: ChannelIdea[] = ideas.map(idea => ({
        id: 'idea-' + Date.now() + '-' + Math.random(), channel: selectedChannelId,
        title: idea, tag: ideaTopic, suggestedMode: videoMode, createdAt: Date.now()
      }));
      const batch = { batchId: Date.now().toString(), createdAt: new Date().toISOString(), ideas: newIdeas };
      setSavedIdeas(prev => ({ ...prev, [selectedChannelId]: [batch, ...(prev[selectedChannelId] || [])] }));
    } catch (err) { console.error(err); }
    finally { setIsGeneratingIdeas(false); }
  };

  // ── Story routing — auto-detects channel and calls right handler ──
  const handleSynthesizeScript = async () => {
    if (!autoTopic) return;
    if (selectedChannelId === 'knowit3d') return handleKnowItStoryboard();
    if (selectedChannelId === 'futurelife') return handleFutureLifeStoryStoryboard();
    return handleAutoStoryboard();
  };

  const handleAutoStoryboard = async () => {
    if (!autoTopic) return;
    saveToHistory();
    setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);
    try {
      const numScenes = Math.max(1, Math.ceil(project.targetTotalDuration / project.sceneDuration));
      const result = await buildStoryboard(autoTopic, selectedChannelId, project.aspectRatio === '9:16', numScenes);
      const entities = analyzeEntities(result);
      const pacing: Record<string, { first: number; last: number }> = {
        mindforged: { first: 0.75, last: 1.25 }, cosmora: { first: 0.85, last: 1.3 },
        veiltheory: { first: 0.9, last: 1.35 }, futurelife: { first: 0.85, last: 1.25 },
        knowit3d: { first: 0.7, last: 1.1 }
      };
      const p = pacing[selectedChannelId] || { first: 0.8, last: 1.2 };
      const newScenes: Scene[] = result.scenes.map((s: any, i: number) => ({
        id: `sc-auto-${i}-${Date.now()}`, order: i, aiPrompt: s.aiPrompt,
        narrationChunk: s.narration, status: 'ready',
        duration: project.sceneDuration * (i === 0 ? p.first : i === result.scenes.length - 1 ? p.last : 1),
        narrationDuration: project.sceneDuration, sfxPrompt: s.sfx,
        frames: [], mediaType: 'ai'
      }));
      const mapped = mapCharactersToScenes(newScenes, entities.characters);
      setProject(prev => ({
        ...prev, title: result.title, globalContext: result.globalContext,
        visualStyle: result.visualStyle, characters: entities.characters,
        environments: entities.environments, scenes: mapped, channelId: selectedChannelId
      }));
      setActiveSceneId(newScenes[0].id);
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err: any) {
      console.error(err); setProjectStatus(ProjectStatus.ERROR);
      setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
    }
  };

  const handleFutureLifeStoryStoryboard = async () => {
    if (!autoTopic) return;
    saveToHistory(); setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);
    try {
      const numScenes = Math.max(1, Math.ceil(project.targetTotalDuration / project.sceneDuration));
      const result = await buildFutureLifeStoryboard(autoTopic, project.aspectRatio === '9:16', numScenes);
      const newScenes: Scene[] = result.scenes.map((s: any, i: number): Scene => ({
        id: `sc-future-${i}-${Date.now()}`, order: i, aiPrompt: s.prompt,
        narrationChunk: s.narration, status: 'ready', duration: project.sceneDuration,
        narrationDuration: project.sceneDuration, sfxPrompt: s.sfx, frames: [], mediaType: 'ai'
      }));
      setProject(prev => ({
        ...prev, title: result.title, globalContext: result.globalContext,
        visualStyle: result.visualStyle, scenes: newScenes, channelId: selectedChannelId
      }));
      setActiveSceneId(newScenes[0].id); setProjectStatus(ProjectStatus.IDLE);
    } catch (err: any) {
      console.error(err); setProjectStatus(ProjectStatus.ERROR);
      setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
    }
  };

  const handleKnowItStoryboard = async () => {
    if (!autoTopic) return;
    saveToHistory(); setProjectStatus(ProjectStatus.GENERATING_STORYBOARD);
    try {
      const result = await buildKnowItStoryboard(autoTopic, project.aspectRatio === '9:16', 5);
      const newScenes: Scene[] = result.scenes.map((s: any, i: number): Scene => ({
        id: `sc-knowit-${i}-${Date.now()}`, order: i, aiPrompt: s.aiPrompt || s.prompt,
        narrationChunk: s.narration, status: 'ready', duration: project.sceneDuration,
        narrationDuration: project.sceneDuration, sfxPrompt: s.sfx,
        shotTypeHint: s.shotTypeHint || 'type-a', scaleLabel: s.scaleLabel || '',
        frames: [], mediaType: 'ai'
      }));
      setProject(prev => ({
        ...prev, title: result.title, globalContext: result.globalContext,
        visualStyle: result.visualStyle, scenes: newScenes, channelId: 'knowit3d'
      }));
      setActiveSceneId(newScenes[0].id); setProjectStatus(ProjectStatus.IDLE);
    } catch (err: any) {
      console.error(err); setProjectStatus(ProjectStatus.ERROR);
      setTimeout(() => setProjectStatus(ProjectStatus.IDLE), 2000);
    }
  };

  const handleGenerateImage = async (id: string) => {
    const scene = project.scenes.find(s => s.id === id);
    if (!scene) return;
    const isKnowIt = project.channelId === 'knowit3d';

    if (isKnowIt) {
      const shotType = (scene as any).shotTypeHint || 'type-a';
      const { imagePrompt } = buildBridgePrompts(scene, project, shotType);
      setFlowBridgePrompt(imagePrompt);
      setFlowBridgeSceneId(id);
      setFlowBridgeCopied(false);
      setBridgeMode('flow');
      setBridgeAutoImported(false);

      if (window.electronAPI?.isElectron) {
        // ── DESKTOP: real embedded browser in right half of window ──
        setIsBridgeOpen(true);
        setBridgeCurrentUrl('https://labs.google/fx/tools/image-fx');
        navigator.clipboard.writeText(imagePrompt).catch(() => {});
        window.electronAPI.openBridge('https://labs.google/fx/tools/image-fx');

      } else if (isCapacitorApp()) {
        // ── MOBILE (Android / iOS): in-app browser sheet ──
        setIsBridgeOpen(true);
        setShowMobileImport(false);
        navigator.clipboard.writeText(imagePrompt).catch(() => {});
        openCapacitorBrowser(
          'https://labs.google/fx/tools/image-fx',
          '⬡ Flow — Cinematic Director',
          (dataUrl) => {
            setIsBridgeOpen(false);
            const sceneId = flowBridgeSceneIdRef.current;
            if (!sceneId) return;
            updateScene(sceneId, {
              frames: [{ id: 'frame-flow-' + Date.now(), index: 0,
                         imageUrl: dataUrl, options: [dataUrl],
                         duration: project.sceneDuration, type: 'ai' as const }],
              status: 'ready',
            }, true);
          },
          () => { setIsBridgeOpen(false); setShowMobileImport(true); },
        );

      } else {
        // ── WEB (Vercel / localhost): original modal + window.open ──
        setIsFlowBridgeOpen(true);
      }
      return;
    }

    setProjectStatus(ProjectStatus.GENERATING_IMAGE);
    try {
      const result = await generateSceneImage(scene, project, mediaMode, imageProvider);
      if (!result) return;
      updateScene(id, { frames: result.frames, clips: result.clips, status: 'ready' });
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Image generation error');
      setProjectStatus(ProjectStatus.ERROR);
    }
  };

  const handleFlowImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !flowBridgeSceneId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      updateScene(flowBridgeSceneId, {
        frames: [{ id: 'frame-flow-' + Date.now(), index: 0, imageUrl: dataUrl,
                   options: [dataUrl], duration: project.sceneDuration, type: 'ai' }],
        status: 'ready',
      }, true);
      setIsFlowBridgeOpen(false);
      setShowMobileImport(false);
      setIsBridgeOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenHunyuanBridge = async () => {
    const scene = project.scenes.find(s => s.id === activeSceneId);
    if (!scene) return;
    const { videoPrompt } = buildBridgePrompts(scene, project, (scene as any).shotTypeHint || 'type-a');
    setHunyuanBridgePrompt(videoPrompt);
    setHunyuanBridgeCopied(false);
    setHunyuanImportUrl('');
    setBridgeMode('hunyuan');
    setBridgeAutoImported(false);

    if (window.electronAPI?.isElectron) {
      // ── DESKTOP: real embedded browser in right half of window ──
      setIsBridgeOpen(true);
      setBridgeCurrentUrl('https://aistudio.tencent.com/visual');
      navigator.clipboard.writeText(videoPrompt).catch(() => {});
      window.electronAPI.openBridge('https://aistudio.tencent.com/visual');

    } else if (isCapacitorApp()) {
      // ── MOBILE (Android / iOS): in-app browser sheet ──
      setIsBridgeOpen(true);
      setShowMobileImport(false);
      navigator.clipboard.writeText(videoPrompt).catch(() => {});
      openCapacitorBrowser(
        'https://aistudio.tencent.com/visual',
        '⬡ Hunyuan — Cinematic Director',
        (dataUrl, mimeType) => {
          setIsBridgeOpen(false);
          if (mimeType && mimeType.startsWith('video/')) {
            updateScene(activeSceneId, { videoUrl: dataUrl, status: 'ready' }, true);
          } else {
            updateScene(activeSceneId, {
              frames: [{ id: 'frame-huy-' + Date.now(), index: 0,
                         imageUrl: dataUrl, options: [dataUrl],
                         duration: project.sceneDuration, type: 'ai' as const }],
              status: 'ready',
            }, true);
          }
        },
        () => { setIsBridgeOpen(false); setShowMobileImport(true); },
      );

    } else {
      // ── WEB: original modal ──
      setIsHunyuanBridgeOpen(true);
    }
  };

  const handleHunyuanImport = () => {
    if (!hunyuanImportUrl) return;
    updateScene(activeSceneId, { videoUrl: hunyuanImportUrl, status: 'ready' }, true);
    setIsHunyuanBridgeOpen(false);
  };

  const handleHunyuanVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateScene(activeSceneId, { videoUrl: URL.createObjectURL(file), status: 'ready' }, true);
    setIsHunyuanBridgeOpen(false);
    setShowMobileImport(false);
    setIsBridgeOpen(false);
  };

  const handleGenerateVideo = async (id: string) => {
    const scene = project.scenes.find(sc => sc.id === id);
    if (!scene) return;
    setProjectStatus(ProjectStatus.GENERATING_VIDEO);
    try {
      const result = await generateSceneVideo(scene, project, async () => '');
      if (!result) return;
      updateScene(id, { frames: result.frames, clips: result.clips, status: 'ready' });
      setProjectStatus(ProjectStatus.IDLE);
    } catch (err) { console.error(err); setProjectStatus(ProjectStatus.ERROR); }
  };

  const handleEnhancePromptAction = async () => {
    if (!activeScene.aiPrompt) return;
    setIsEnhancingPrompt(true);
    try { updateScene(activeSceneId, { aiPrompt: await enhancePrompt(activeScene.aiPrompt) }, true); }
    catch {} finally { setIsEnhancingPrompt(false); }
  };

  const handleBrainstormStyle = async () => {
    setIsBrainstormingStyle(true);
    try {
      const style = await generateCustomStyle(autoTopic || 'Educational 3D Animation', project.globalContext || '');
      saveToHistory(); setProject(p => ({ ...p, visualStyle: style }));
    } catch {} finally { setIsBrainstormingStyle(false); }
  };

  const handleBakeNarration = async (id: string) => {
    const s = project.scenes.find(sc => sc.id === id);
    if (!s?.narrationChunk) return;
    setProjectStatus(ProjectStatus.GENERATING_NARRATION);
    try {
      const voice = NARRATOR_VOICES.find(v => v.name === project.narratorVoice) || NARRATOR_VOICES[0];
      const base64 = await generateNarration(s.narrationChunk, voice.value, project.narrationScript, project.voiceSettings.speed, project.voiceSettings.energy);
      const audioUrl = `data:audio/pcm;base64,${base64}`;
      const ctx = new AudioContext();
      const buf = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      updateScene(id, { narrationAudioUrl: audioUrl, narrationDuration: buf.duration, duration: buf.duration }, true);
      setProjectStatus(ProjectStatus.IDLE);
    } catch { setProjectStatus(ProjectStatus.ERROR); }
  };

  const handlePreviewVoice = async (name: string, value: string) => {
    setIsPreviewingVoice(name);
    try {
      const b64 = await generateNarration('This is a sample of the ' + name + ' voice.', value, project.narrationScript, project.voiceSettings.speed, project.voiceSettings.energy);
      await playRawPcm(`data:audio/pcm;base64,${b64}`);
    } catch {} finally { setIsPreviewingVoice(null); }
  };

  const handleBakeMusicScore = async () => {
    setProjectStatus(ProjectStatus.GENERATING_NARRATION);
    try {
      const b64 = await generateNarration('... background beat ... atmosphere ...', 'Zephyr', `Rhythmic background for ${project.audioConfig.musicVibe}`);
      const clip: AudioClip = { id: 'music-' + Date.now(), content: `Score: ${project.audioConfig.musicVibe}`, startTime: 0, duration: totalLength, type: 'music', audioUrl: `data:audio/pcm;base64,${b64}` };
      saveToHistory();
      setProject(p => { const t = [...p.extraTracks]; t[0] = [clip]; return { ...p, extraTracks: t }; });
      setProjectStatus(ProjectStatus.IDLE);
    } catch { setProjectStatus(ProjectStatus.ERROR); }
  };

  const handleBakeSFX = async () => {
    if (!activeScene.sfxPrompt) return;
    setProjectStatus(ProjectStatus.GENERATING_NARRATION);
    try {
      const b64 = await generateNarration(activeScene.sfxPrompt, 'Fenrir', 'High-quality foley SFX');
      const clip: AudioClip = { id: 'sfx-' + Date.now(), content: activeScene.sfxPrompt, startTime: currentTime, duration: 3, type: 'sfx', audioUrl: `data:audio/pcm;base64,${b64}` };
      saveToHistory();
      setProject(p => { const t = [...p.extraTracks]; t[1] = [...t[1], clip]; return { ...p, extraTracks: t }; });
      setProjectStatus(ProjectStatus.IDLE);
    } catch { setProjectStatus(ProjectStatus.ERROR); }
  };

  const updateGlobalAudioClip = (ti: number, cid: string, updates: Partial<AudioClip>, fin = false) => {
    if (fin) saveToHistory();
    setProject(p => { const t = [...p.extraTracks]; t[ti] = t[ti].map(c => c.id === cid ? { ...c, ...updates } : c); return { ...p, extraTracks: t }; });
  };

  const addGlobalAudioClip = (ti: number, startTime: number) => {
    saveToHistory();
    const clip: AudioClip = { id: 'clip-' + Date.now(), content: ti === 0 ? 'Score Layer' : 'FX Layer', startTime, duration: 5, type: ti === 0 ? 'music' : 'sfx' };
    setProject(p => { const t = [...p.extraTracks]; t[ti] = [...t[ti], clip]; return { ...p, extraTracks: t }; });
  };

  const removeGlobalAudioClip = (ti: number, cid: string) => {
    saveToHistory();
    setProject(p => { const t = [...p.extraTracks]; t[ti] = t[ti].filter(c => c.id !== cid); return { ...p, extraTracks: t }; });
  };

  const handleTabClick = (tab: AppTab) => {
    if (activeTab === tab) setIsPanelCollapsed(!isPanelCollapsed);
    else { setActiveTab(tab); setIsPanelCollapsed(false); }
  };

  const handleResizeTimelineStart = (e: React.MouseEvent) => {
    e.preventDefault(); setIsResizingTimeline(true);
    dragStartYRef.current = e.clientY; startHeightRef.current = timelineHeight;
    window.addEventListener('mousemove', handleResizeTimelineMove);
    window.addEventListener('mouseup', handleResizeTimelineEnd);
  };

  const handleResizeTimelineMove = (e: MouseEvent) => {
    const delta = dragStartYRef.current - e.clientY;
    const h = Math.max(32, Math.min(window.innerHeight - 200, startHeightRef.current + delta));
    setTimelineHeight(h);
    if (h > 40 && isTimelineMinimized) setIsTimelineMinimized(false);
    else if (h <= 40 && !isTimelineMinimized) setIsTimelineMinimized(true);
  };

  const handleResizeTimelineEnd = () => {
    setIsResizingTimeline(false);
    window.removeEventListener('mousemove', handleResizeTimelineMove);
    window.removeEventListener('mouseup', handleResizeTimelineEnd);
  };

  const handleToggleMinimize = () => {
    setIsTimelineMinimized(!isTimelineMinimized);
    setTimelineHeight(isTimelineMinimized ? 180 : 32);
  };

  const handleStartRender = async () => {
    setRenderingStatus(RenderingStatus.PROCESSING); setRenderProgress(0);
    for (const stage of ['Sequencing...', 'Mixing...', 'Exporting...']) {
      setRenderMessage(stage);
      for (let j = 0; j < 33; j++) { setRenderProgress(p => Math.min(100, p + 1)); await new Promise(r => setTimeout(r, 30)); }
    }
    setRenderingStatus(RenderingStatus.FINISHED); setRenderMessage('Complete.');
  };

  const updateCaptionConfig = (updates: Partial<CaptionConfig>) => {
    saveToHistory(); setProject(p => ({ ...p, captionConfig: { ...p.captionConfig, ...updates } }));
  };

  const updateVoiceSettings = (updates: Partial<VoiceSettings>) => {
    saveToHistory(); setProject(p => ({ ...p, voiceSettings: { ...p.voiceSettings, ...updates } }));
  };

  const isKnowIt3D = project.channelId === 'knowit3d';
  const hasImageForActiveScene = !!(activeScene.frames?.[0]?.imageUrl);

  // ══════════════════════════════
  // CHANNEL SCREEN
  // ══════════════════════════════
  if (appMode === 'channels') {
    return (
      <div className="h-screen w-screen bg-[#050507] text-white flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center mb-2">
          <div className="text-[10px] font-black uppercase tracking-[4px] text-slate-600 mb-2">Cinematic Veo Director</div>
          <h1 className="text-xl font-black uppercase tracking-widest">Select Channel</h1>
        </div>
        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
          {CHANNELS.map(channel => (
            <button
              key={channel.id}
              disabled={channel.disabled}
              onClick={() => { if (!channel.disabled) { setSelectedChannelId(channel.id); setVideoMode(channel.defaultMode); setAppMode('ideas'); } }}
              className={`p-5 rounded-2xl border transition-all text-left relative ${
                channel.disabled
                  ? 'bg-[#0c0c14] border-white/5 opacity-40 cursor-not-allowed'
                  : channel.id === 'knowit3d'
                    ? 'bg-[#0f0f1e] border-violet-500/40 hover:border-violet-400 hover:shadow-lg hover:shadow-violet-500/15'
                    : channel.primaryType === 'ai'
                      ? 'bg-[#14141c] border-purple-500/30 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/15'
                      : 'bg-[#14141c] border-cyan-500/20 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/15'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                  channel.id === 'knowit3d' ? 'bg-violet-500/20 text-violet-400' :
                  channel.primaryType === 'ai' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  <i className={`fas ${channel.icon}`} />
                </div>
                <div className="font-black text-sm text-white">{channel.name}</div>
                {channel.id === 'knowit3d' && (
                  <div className="ml-auto text-[7px] font-black uppercase tracking-widest bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/30">New</div>
                )}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide pl-11">{channel.category}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════
  // IDEAS SCREEN
  // ══════════════════════════════
  if (appMode === 'ideas') {
    const channelIdeas = savedIdeas[selectedChannelId] || [];
    const ch = CHANNELS.find(c => c.id === selectedChannelId);
    return (
      <div className="h-screen w-screen bg-[#050507] text-white flex flex-col p-8 gap-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${selectedChannelId === 'knowit3d' ? 'bg-violet-500/20 text-violet-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
            <i className={`fas ${ch?.icon || 'fa-lightbulb'}`} />
          </div>
          <h1 className="text-xl font-black uppercase tracking-widest">{ch?.name}</h1>
        </div>
        <div className="flex gap-3">
          <input value={ideaTopic} onChange={e => setIdeaTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerateIdeaList()} placeholder="Enter topic..." className="flex-1 bg-[#14141c] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500" />
          <button onClick={handleGenerateIdeaList} disabled={isGeneratingIdeas} className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-black text-sm disabled:opacity-50">
            {isGeneratingIdeas ? '...' : 'Generate'}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {channelIdeas.length === 0 && <div className="text-slate-500 text-sm">No ideas yet. Generate one above.</div>}
          {channelIdeas.map(batch => {
            const isOpen = expandedBatch === batch.batchId;
            return (
              <div key={batch.batchId} className="bg-[#14141c] border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedBatch(isOpen ? null : batch.batchId)} className="w-full p-4 text-left flex justify-between items-center hover:bg-white/5 transition-all">
                  <div>
                    <div className="font-black text-sm">Generated {batch.ideas.length} Ideas</div>
                    <div className="text-xs text-slate-500">{new Date(batch.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="text-xs text-slate-500">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-col border-t border-white/10">
                    {batch.ideas.map((idea: any) => (
                      <button key={idea.id} onClick={() => { setAutoTopic(idea.title); setAppMode('editor'); }} className="p-3 text-left hover:bg-cyan-500/10 text-sm border-b border-white/5 last:border-0 transition-colors">
                        {idea.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => setAppMode('channels')} className="text-slate-500 text-xs hover:text-white transition-colors">← Back to Channels</button>
          <button
            onClick={() => { setAutoTopic(''); setAppMode('editor'); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all"
          >
            Skip → Go to Editor
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════
  // MAIN EDITOR
  // ══════════════════════════════
  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[#050507] text-[#f1f5f9] ${isResizingTimeline ? 'cursor-row-resize' : ''}`}>

      {/* HEADER */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-5 bg-[#0a0a0f] shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 via-cyan-400 to-blue-500 flex items-center justify-center">
            <i className="fas fa-cube text-white text-xs"></i>
          </div>
          <input value={project.title} onFocus={saveToHistory} onChange={e => setProject({ ...project, title: e.target.value })} className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none outline-none text-slate-500 focus:text-white w-48 truncate" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setAppMode('channels')} className="text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-all">
            Channels
          </button>
          <button onClick={() => { setIsRenderModalOpen(true); setRenderingStatus(RenderingStatus.IDLE); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
            Render
          </button>
        </div>
      </header>

      {/* RENDER MODAL */}
      {isRenderModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-md bg-[#0c0c12] border border-white/10 rounded-[2rem] p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-black uppercase tracking-widest">Master Studio Render</h2>
              <button onClick={() => setIsRenderModalOpen(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            {renderingStatus === RenderingStatus.IDLE ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  {['720p', '1080p'].map(r => (
                    <button key={r} onClick={() => setExportSettings({ ...exportSettings, resolution: r as any })} className={`p-4 rounded-xl border text-[10px] font-black uppercase ${exportSettings.resolution === r ? 'bg-blue-600 border-blue-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>{r}</button>
                  ))}
                </div>
                <button onClick={handleStartRender} className="w-full py-4 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase">Start Export</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/5" />
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={213.6} strokeDashoffset={213.6 * (1 - renderProgress / 100)} className="text-blue-500 transition-all duration-300" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-black">{renderProgress}%</div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{renderMessage}</p>
                {renderingStatus === RenderingStatus.FINISHED && (
                  <button onClick={() => setIsRenderModalOpen(false)} className="px-8 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase">Close</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════
          ELECTRON BRIDGE PANEL  (desktop app only)
          The real browser lives in the RIGHT 50% of the window,
          controlled by electron/main.cjs.  This floating card
          sits on the LEFT side and gives you controls + status.
      ════════════════════════════════════════════════════════ */}
      {isBridgeOpen && window.electronAPI?.isElectron && (
        <div className="fixed bottom-52 right-[52%] z-[200] w-72 pointer-events-auto">
          <div className="bg-[#0c0c12] border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">

            {/* header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${bridgeMode === 'flow' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {bridgeMode === 'flow' ? '⬡ Flow Image Bridge' : '⬡ Hunyuan Video Bridge'}
                </span>
              </div>
              <button
                onClick={() => { window.electronAPI!.hideBridge(); setIsBridgeOpen(false); }}
                className="text-slate-500 hover:text-white transition-colors"
              >✕</button>
            </div>

            {/* current URL */}
            {bridgeCurrentUrl && (
              <p className="text-[8px] text-slate-600 font-mono truncate">{bridgeCurrentUrl}</p>
            )}

            {/* prompt */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 max-h-24 overflow-y-auto">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">
                {bridgeMode === 'flow' ? 'Image Prompt (already copied)' : 'Motion Prompt (already copied)'}
              </p>
              <p className="text-[9px] text-slate-400 leading-relaxed font-mono">
                {bridgeMode === 'flow' ? flowBridgePrompt : hunyuanBridgePrompt}
              </p>
            </div>

            {/* copy again */}
            <button
              onClick={() => {
                const p = bridgeMode === 'flow' ? flowBridgePrompt : hunyuanBridgePrompt;
                navigator.clipboard.writeText(p).catch(() => {});
                setFlowBridgeCopied(true);
                setTimeout(() => setFlowBridgeCopied(false), 2000);
              }}
              className={`w-full py-2 rounded-xl text-[9px] font-black uppercase border transition-all
                ${flowBridgeCopied ? 'bg-green-500 text-black border-green-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              {flowBridgeCopied ? '✓ Copied!' : '⎘ Copy Prompt Again'}
            </button>

            {/* browser nav controls */}
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '← Back',    fn: () => window.electronAPI!.goBack() },
                { label: '↺ Reload',  fn: () => window.electronAPI!.reload() },
                { label: 'Fwd →',     fn: () => window.electronAPI!.goForward() },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn}
                  className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] text-slate-400 transition-all">
                  {label}
                </button>
              ))}
            </div>

            {/* auto-import status */}
            {bridgeAutoImported ? (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
                <span className="text-green-400">✓</span>
                <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">Auto-imported to scene!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <span className="text-slate-500 text-xs">⬇</span>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest">
                  Download in the browser → imports automatically
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MOBILE IMPORT PANEL  (Capacitor Android / iOS only)
          After the in-app browser closes the user taps here
          to pick the image/video they just saved to the gallery.
      ════════════════════════════════════════════════════════ */}
      {showMobileImport && isCapacitorApp() && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#0c0c12] border border-white/15 rounded-[2rem] p-8 space-y-5">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black uppercase tracking-widest">
                  {bridgeMode === 'flow' ? 'Import Your Image' : 'Import Your Video'}
                </h2>
                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">
                  Pick the file you just downloaded
                </p>
              </div>
              <button onClick={() => setShowMobileImport(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {/* prompt reminder */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 max-h-20 overflow-y-auto">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Your prompt was</p>
              <p className="text-[9px] text-slate-400 font-mono leading-relaxed">
                {bridgeMode === 'flow' ? flowBridgePrompt : hunyuanBridgePrompt}
              </p>
            </div>

            {bridgeMode === 'flow' ? (
              <label className="w-full py-6 bg-[#14141c] border-2 border-dashed border-blue-500/40
                                rounded-2xl flex flex-col items-center gap-3 cursor-pointer
                                hover:border-blue-400/70 active:scale-[0.98] transition-all">
                <i className="fas fa-image text-3xl text-blue-400"></i>
                <span className="text-[10px] font-black uppercase text-blue-300">Tap to pick image from gallery</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFlowImageUpload} />
              </label>
            ) : (
              <>
                <label className="w-full py-6 bg-[#14141c] border-2 border-dashed border-purple-500/40
                                  rounded-2xl flex flex-col items-center gap-3 cursor-pointer
                                  hover:border-purple-400/70 active:scale-[0.98] transition-all">
                  <i className="fas fa-film text-3xl text-purple-400"></i>
                  <span className="text-[10px] font-black uppercase text-purple-300">Tap to pick video from gallery</span>
                  <input type="file" accept="video/*" className="hidden" onChange={handleHunyuanVideoUpload} />
                </label>
                <div className="flex gap-2">
                  <input value={hunyuanImportUrl} onChange={e => setHunyuanImportUrl(e.target.value)}
                    placeholder="Or paste video URL..."
                    className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-[10px] outline-none focus:border-purple-500" />
                  <button onClick={() => { if (!hunyuanImportUrl) return; updateScene(activeSceneId, { videoUrl: hunyuanImportUrl, status: 'ready' }, true); setShowMobileImport(false); }}
                    disabled={!hunyuanImportUrl}
                    className="px-5 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase disabled:opacity-30">
                    Import
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          FILES PANEL  — permanent media library (Capacitor only)
          Shows all images & videos from phone storage.
          Tap any file to use it in the current scene instantly.
      ════════════════════════════════════════════════════════ */}
      {showFilesPanel && isCapacitorApp() && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[#070709]">

          {/* header */}
          <div className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-black uppercase tracking-widest text-white">
                <i className="fas fa-photo-film mr-2 text-cyan-400"></i>Files
              </h2>
              <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-widest">
                Tap any file to import into scene · {filesLibrary.length} files
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setIsScanningFiles(true);
                  const Filesystem = (window as any).Capacitor?.Plugins?.Filesystem;
                  if (Filesystem) {
                    try {
                      await Filesystem.requestPermissions();
                    } catch {}
                  }
                  const files = await scanFilesLibrary();
                  setFilesLibrary(files);
                  setIsScanningFiles(false);
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-[9px] font-black uppercase text-slate-300 transition-all"
              >
                {isScanningFiles ? (
                  <><i className="fas fa-spinner fa-spin mr-1"></i>Scanning...</>
                ) : (
                  <><i className="fas fa-rotate mr-1"></i>Refresh</>
                )}
              </button>
              <button
                onClick={() => setShowFilesPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-slate-400 hover:text-white"
              >✕</button>
            </div>
          </div>

          {/* file grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isScanningFiles ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Scanning phone storage...</p>
              </div>
            ) : filesLibrary.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <i className="fas fa-folder-open text-4xl text-slate-700"></i>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">
                  No files found yet.<br/>Generate an image or video first,<br/>then tap Refresh.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filesLibrary.map(file => (
                  <button
                    key={file.id}
                    onClick={() => {
                      if (file.type === 'image') {
                        updateScene(activeSceneId, {
                          frames: [{ id: 'frame-lib-' + Date.now(), index: 0,
                                     imageUrl: file.dataUrl, options: [file.dataUrl],
                                     duration: project.sceneDuration, type: 'ai' as const }],
                          status: 'ready',
                        }, true);
                      } else {
                        updateScene(activeSceneId, { videoUrl: file.dataUrl, status: 'ready' }, true);
                      }
                      setShowFilesPanel(false);
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/60 active:scale-95 transition-all"
                  >
                    {file.type === 'image' ? (
                      <img src={file.dataUrl} className="w-full h-full object-cover" alt={file.name} />
                    ) : (
                      <div className="w-full h-full bg-black/60 flex flex-col items-center justify-center gap-1">
                        <i className="fas fa-film text-2xl text-purple-400"></i>
                        <span className="text-[7px] text-slate-400 px-1 text-center truncate w-full">{file.name.slice(0, 20)}</span>
                      </div>
                    )}
                    {/* file type badge */}
                    <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[7px] font-black ${file.type === 'image' ? 'bg-blue-500/80' : 'bg-purple-500/80'} text-white`}>
                      {file.type === 'image' ? 'IMG' : 'VID'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* bottom action — open browser to generate more */}
          <div className="px-4 pb-8 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setShowFilesPanel(false);
                // triggers the normal generate flow
              }}
              className="py-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase text-slate-300 hover:bg-white/10 transition-all"
            >
              ← Back to Editor
            </button>
            <button
              onClick={async () => {
                setIsScanningFiles(true);
                const files = await scanFilesLibrary();
                setFilesLibrary(files);
                setIsScanningFiles(false);
              }}
              className="py-3 bg-cyan-500/20 border border-cyan-500/40 rounded-2xl text-[9px] font-black uppercase text-cyan-300 hover:bg-cyan-500/30 transition-all"
            >
              <i className="fas fa-rotate mr-1"></i>Scan for New Files
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          WEB FALLBACK MODALS  (Vercel / localhost only)
          These show when running in a normal browser.
          Electron and Capacitor never reach these blocks.
      ════════════════════════════════════════════════════════ */}

      {/* FLOW BRIDGE MODAL — web only */}
      {isFlowBridgeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-xl bg-[#0c0c12] border border-white/10 rounded-[2rem] p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest">Flow Image Bridge</h2>
                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">Step 1 — Generate in Flow · Step 2 — Upload back</p>
              </div>
              <button onClick={() => setIsFlowBridgeOpen(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-5 max-h-44 overflow-y-auto">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Image Prompt</p>
              <p className="text-[10px] text-slate-300 leading-relaxed font-mono">{flowBridgePrompt}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={() => { navigator.clipboard.writeText(flowBridgePrompt); setFlowBridgeCopied(true); setTimeout(() => setFlowBridgeCopied(false), 3000); }}
                className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${flowBridgeCopied ? 'bg-green-500 text-black border-green-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                {flowBridgeCopied ? '✓ Copied!' : '⎘ Copy Prompt'}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(flowBridgePrompt); setFlowBridgeCopied(true); window.open('https://labs.google/fx/tools/image-fx', '_blank'); }}
                className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-all">
                Open Flow ↗
              </button>
            </div>
            <div className="border-t border-white/10 pt-5">
              <label className="w-full py-5 bg-[#14141c] border border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:border-cyan-400/50 transition-all">
                <i className="fas fa-cloud-arrow-up text-2xl text-slate-500"></i>
                <span className="text-[9px] font-black uppercase text-slate-500">Upload downloaded image</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFlowImageUpload} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* HUNYUAN BRIDGE MODAL — web only */}
      {isHunyuanBridgeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-xl bg-[#0c0c12] border border-white/10 rounded-[2rem] p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest">Hunyuan Video Bridge</h2>
                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">Step 1 — Generate in Hunyuan · Step 2 — Import back</p>
              </div>
              <button onClick={() => setIsHunyuanBridgeOpen(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            {hasImageForActiveScene && (
              <div className="mb-5 rounded-xl overflow-hidden h-28 bg-black border border-white/10">
                <img src={activeScene.frames?.[0]?.imageUrl} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-5 max-h-36 overflow-y-auto">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Motion Prompt</p>
              <p className="text-[10px] text-slate-300 leading-relaxed font-mono">{hunyuanBridgePrompt}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={() => { navigator.clipboard.writeText(hunyuanBridgePrompt); setHunyuanBridgeCopied(true); setTimeout(() => setHunyuanBridgeCopied(false), 3000); }}
                className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${hunyuanBridgeCopied ? 'bg-green-500 text-black border-green-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                {hunyuanBridgeCopied ? '✓ Copied!' : '⎘ Copy Prompt'}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(hunyuanBridgePrompt); setHunyuanBridgeCopied(true); window.open('https://aistudio.tencent.com/visual', '_blank'); }}
                className="py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[9px] font-black uppercase transition-all">
                Open Hunyuan ↗
              </button>
            </div>
            <div className="border-t border-white/10 pt-5 space-y-3">
              <div className="flex gap-2">
                <input value={hunyuanImportUrl} onChange={e => setHunyuanImportUrl(e.target.value)}
                  placeholder="Paste video URL..."
                  className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-[10px] outline-none focus:border-purple-500" />
                <button onClick={() => { if (!hunyuanImportUrl) return; updateScene(activeSceneId, { videoUrl: hunyuanImportUrl, status: 'ready' }, true); setIsHunyuanBridgeOpen(false); }}
                  disabled={!hunyuanImportUrl}
                  className="px-5 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase disabled:opacity-30">
                  Import
                </button>
              </div>
              <label className="w-full py-4 bg-[#14141c] border border-dashed border-white/20 rounded-xl flex flex-col items-center gap-1 cursor-pointer hover:border-purple-400/50 transition-all">
                <i className="fas fa-cloud-arrow-up text-xl text-slate-500"></i>
                <span className="text-[9px] font-black uppercase text-slate-500">Or upload video file</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleHunyuanVideoUpload} />
              </label>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">

        {/* SIDEBAR TABS */}
        <aside className="w-12 border-r border-white/5 bg-[#0a0a0f] flex flex-col shrink-0 z-40">
          <div className="flex-1 flex flex-col items-center py-5 gap-5 overflow-y-auto">
            {(['story', 'style', 'visuals', 'text', 'voice', 'score', 'foley'] as AppTab[]).map(tab => (
              <button key={tab} onClick={() => handleTabClick(tab)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeTab === tab && !isPanelCollapsed ? 'bg-cyan-500 text-black' : 'text-slate-600 hover:text-white'}`}>
                <i className={`fas fa-${tab === 'story' ? 'wand-magic-sparkles' : tab === 'style' ? 'palette' : tab === 'visuals' ? 'clapperboard' : tab === 'text' ? 'font' : tab === 'voice' ? 'microphone-lines' : tab === 'score' ? 'music' : 'bolt-lightning'} text-xs`}></i>
              </button>
            ))}
          </div>
          <button onClick={() => setIsPanelCollapsed(!isPanelCollapsed)} className="pb-4 flex justify-center text-slate-800 hover:text-white">
            <i className={`fas fa-chevron-${isPanelCollapsed ? 'right' : 'left'} text-[9px]`}></i>
          </button>
        </aside>

        {/* SIDE PANEL */}
        <div className={`absolute top-0 bottom-0 left-12 h-full transition-all duration-300 border-r border-white/5 bg-[#0c0c12]/98 backdrop-blur-2xl flex flex-col overflow-hidden z-[60] shadow-2xl ${isPanelCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-72 opacity-100'}`}>
          <div className="p-5 flex flex-col h-full gap-5 overflow-y-auto custom-scroll min-w-[18rem]">

            {/* STORY TAB */}
            {activeTab === 'story' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-cyan-400 tracking-widest">Story Architect</h3>
                {isKnowIt3D && (
                  <div className="px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-xl text-[8px] font-black uppercase text-violet-400 text-center tracking-widest">
                    KnowIt3D Script Mode
                  </div>
                )}
                <textarea value={autoTopic} onChange={e => setAutoTopic(e.target.value)} className="w-full h-28 bg-[#14141c] border border-white/5 rounded-xl p-4 text-xs outline-none resize-none focus:border-cyan-500" placeholder={isKnowIt3D ? "Enter body science topic..." : "Enter video topic..."} />
                <button
                  onClick={handleSynthesizeScript}
                  disabled={projectStatus === ProjectStatus.GENERATING_STORYBOARD}
                  className={`w-full py-4 rounded-xl text-[10px] font-black uppercase transition-all ${isKnowIt3D ? 'bg-violet-500 hover:bg-violet-400 text-white' : 'bg-cyan-500 text-black'} disabled:opacity-50`}
                >
                  {projectStatus === ProjectStatus.GENERATING_STORYBOARD ? 'Building...' : 'Synthesize Script'}
                </button>
              </div>
            )}

            {/* STYLE TAB */}
            {activeTab === 'style' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-cyan-400 tracking-widest">Visual Aesthetic</h3>
                <textarea value={project.visualStyle} onChange={e => setProject({ ...project, visualStyle: e.target.value })} className="w-full h-28 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[10px] outline-none resize-none" />
                <button onClick={handleBrainstormStyle} disabled={isBrainstormingStyle} className="w-full py-3 bg-white/5 text-[9px] font-black uppercase rounded-xl border border-white/10">
                  {isBrainstormingStyle ? 'Thinking...' : 'AI Brainstorm'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_STYLES.map(s => (
                    <button key={s.name} onClick={() => setProject({ ...project, visualStyle: s.value })} className="p-3 bg-[#14141c] border border-white/5 rounded-xl text-[8px] font-black uppercase hover:bg-cyan-500/10 transition-all text-center">{s.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* VISUALS TAB */}
            {activeTab === 'visuals' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-cyan-400 tracking-widest">Scene Directing</h3>
                <textarea value={activeScene.aiPrompt || ''} onChange={e => updateScene(activeSceneId, { aiPrompt: e.target.value })} className="w-full h-28 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[10px] outline-none resize-none" placeholder="Scene description..." />
                <button onClick={handleEnhancePromptAction} disabled={isEnhancingPrompt} className="w-full py-3 bg-white/5 text-[9px] font-black uppercase rounded-xl border border-white/10">
                  {isEnhancingPrompt ? 'Enhancing...' : 'Enhance Directive'}
                </button>

                {isKnowIt3D ? (
                  <div className="space-y-3">
                    <div className="px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-xl text-[8px] font-black uppercase text-violet-400 text-center tracking-widest">KnowIt3D — Bridge Mode</div>
                    <button onClick={() => handleGenerateImage(activeSceneId)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2">
                      <i className="fas fa-image"></i> Generate Frame via Flow
                    </button>
                    <button onClick={handleOpenHunyuanBridge} disabled={!hasImageForActiveScene} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
                      <i className="fas fa-video"></i> {hasImageForActiveScene ? 'Generate Video via Hunyuan' : 'Generate Image First'}
                    </button>
                    {isCapacitorApp() && (
                      <button
                        onClick={async () => {
                          setShowFilesPanel(true);
                          setIsScanningFiles(true);
                          const Filesystem = (window as any).Capacitor?.Plugins?.Filesystem;
                          if (Filesystem) { try { await Filesystem.requestPermissions(); } catch {} }
                          const files = await scanFilesLibrary();
                          setFilesLibrary(files);
                          setIsScanningFiles(false);
                        }}
                        className="w-full py-3 bg-[#0f1a1a] border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-400 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-photo-film"></i> Browse Files Library
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button onClick={() => setMediaMode('ai')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase border ${mediaMode === 'ai' ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>AI Mode</button>
                      <button onClick={() => setMediaMode('stock')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase border ${mediaMode === 'stock' ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>Stock Mode</button>
                    </div>
                    {mediaMode === 'ai' && (
                      <div className="grid grid-cols-3 gap-2">
                        {(['gemini', 'flow', 'wix'] as const).map(p => (
                          <button key={p} onClick={() => setImageProvider(p)} className={`py-2 rounded-lg text-[8px] font-black uppercase border ${imageProvider === p ? 'bg-purple-500 text-black border-purple-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>{p}</button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => handleGenerateImage(activeSceneId)} className="w-full py-4 bg-white text-black rounded-xl text-[9px] font-black uppercase transition-all">
                      {mediaMode === 'ai' ? 'Generate AI Frame' : 'Load Stock Frame'}
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleGenerateVideo(activeSceneId)} disabled={!hasImageForActiveScene} className="py-4 bg-cyan-500 text-black rounded-xl text-[9px] font-black uppercase disabled:opacity-20">Generate Video</button>
                      <button disabled className="py-4 bg-black text-slate-700 rounded-xl text-[9px] font-black uppercase border border-white/5 cursor-not-allowed">Coming Soon</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TEXT TAB */}
            {activeTab === 'text' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Typography Suite</h3>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Text</label>
                  <textarea value={activeScene.narrationChunk || ''} onChange={e => updateScene(activeSceneId, { narrationChunk: e.target.value })} className="w-full h-20 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[11px] outline-none" />
                </div>
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updateCaptionConfig({ showCaptions: !project.captionConfig.showCaptions })} className={`py-3 rounded-xl text-[8px] font-black uppercase border ${project.captionConfig.showCaptions ? 'bg-amber-500 text-black' : 'bg-[#14141c] text-slate-500'}`}>Show Text</button>
                    <button onClick={() => updateCaptionConfig({ isUppercase: !project.captionConfig.isUppercase })} className={`py-3 rounded-xl text-[8px] font-black uppercase border ${project.captionConfig.isUppercase ? 'bg-amber-500 text-black' : 'bg-[#14141c] text-slate-500'}`}>Uppercase</button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Font Family</label>
                    <select value={project.captionConfig.fontFamily} onChange={e => updateCaptionConfig({ fontFamily: e.target.value })} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                      {AVAILABLE_FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Font Size</label><span className="text-[8px] font-black text-amber-500">{project.captionConfig.fontSize}px</span></div>
                    <input type="range" min="3" max="120" value={parseInt(project.captionConfig.fontSize)} onChange={e => updateCaptionConfig({ fontSize: e.target.value })} className="w-full h-1 bg-white/10 appearance-none accent-amber-500 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Text Color</label>
                      <input type="color" value={project.captionConfig.color} onChange={e => updateCaptionConfig({ color: e.target.value })} className="w-full h-10 bg-[#14141c] border border-white/5 rounded-xl outline-none cursor-pointer" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">BG Color</label>
                      <input type="color" value={project.captionConfig.backgroundColor.slice(0, 7)} onChange={e => updateCaptionConfig({ backgroundColor: e.target.value + 'b3' })} className="w-full h-10 bg-[#14141c] border border-white/5 rounded-xl outline-none cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entrance Animation</label>
                    <select value={project.captionConfig.animationType} onChange={e => updateCaptionConfig({ animationType: e.target.value })} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                      {ENTRANCE_ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Text Effect</label>
                    <select value={project.captionConfig.textEffect} onChange={e => updateCaptionConfig({ textEffect: e.target.value })} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                      {TEXT_EFFECTS.map(e => <option key={e.value} value={e.value}>{e.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* VOICE TAB */}
            {activeTab === 'voice' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Narrator Engine</h3>
                <div className="space-y-3">
                  {NARRATOR_VOICES.map(v => (
                    <div key={v.name} className="flex gap-2">
                      <button onClick={() => setProject({ ...project, narratorVoice: v.name })} className={`flex-1 p-4 rounded-xl text-[9px] font-black uppercase text-left border transition-all ${project.narratorVoice === v.name ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>
                        <div>{v.name}</div><div className="text-[7px] opacity-60">{v.desc}</div>
                      </button>
                      <button onClick={() => handlePreviewVoice(v.name, v.value)} disabled={isPreviewingVoice !== null} className={`w-10 rounded-xl border border-white/5 bg-[#14141c] flex items-center justify-center text-slate-500 hover:text-white transition-all ${isPreviewingVoice === v.name ? 'animate-pulse text-amber-500' : ''}`}>
                        <i className={`fas ${isPreviewingVoice === v.name ? 'fa-circle-notch animate-spin' : 'fa-play'} text-xs`}></i>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Speed</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['slow', 'normal', 'fast'] as const).map(s => (
                        <button key={s} onClick={() => updateVoiceSettings({ speed: s })} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${project.voiceSettings.speed === s ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Energy</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'normal', 'high'] as const).map(e => (
                        <button key={e} onClick={() => updateVoiceSettings({ energy: e })} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${project.voiceSettings.energy === e ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#14141c] border-white/5 text-slate-500'}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Delivery Tone</label>
                    <select value={project.narrationScript} onChange={e => setProject({ ...project, narrationScript: e.target.value })} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-3 text-[10px] outline-none">
                      {VOICE_TONES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => handleBakeNarration(activeSceneId)} className="w-full py-4 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">Synthesize Script</button>
              </div>
            )}

            {/* SCORE TAB */}
            {activeTab === 'score' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Music Bed</h3>
                <input value={project.audioConfig.musicVibe} onChange={e => setProject({ ...project, audioConfig: { ...project.audioConfig, musicVibe: e.target.value } })} className="w-full bg-[#14141c] border border-white/5 rounded-xl p-4 text-xs outline-none" placeholder="Atmospheric, Upbeat..." />
                <div className="p-4 bg-[#14141c] border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400">Audio Ducking</span>
                    <button onClick={() => setProject({ ...project, audioConfig: { ...project.audioConfig, duckingEnabled: !project.audioConfig.duckingEnabled } })} className={`w-10 h-5 rounded-full relative transition-all ${project.audioConfig.duckingEnabled ? 'bg-blue-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${project.audioConfig.duckingEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  <p className="text-[7px] text-slate-600 uppercase leading-relaxed">Automatically lowers music when narrator is speaking.</p>
                </div>
                <button onClick={handleBakeMusicScore} className="w-full py-4 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase">Generate Music Bed</button>
                <div className="space-y-2">
                  <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest"><span>Volume</span><span>{project.audioConfig.musicVolume}%</span></div>
                  <input type="range" min="0" max="100" value={project.audioConfig.musicVolume} onChange={e => setProject({ ...project, audioConfig: { ...project.audioConfig, musicVolume: parseInt(e.target.value) } })} className="w-full h-1 bg-white/10 appearance-none accent-blue-500 rounded-full" />
                </div>
              </div>
            )}

            {/* FOLEY TAB */}
            {activeTab === 'foley' && (
              <div className="space-y-5">
                <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sound FX</h3>
                <textarea value={activeScene.sfxPrompt || ''} onChange={e => updateScene(activeSceneId, { sfxPrompt: e.target.value })} className="w-full h-20 bg-[#14141c] border border-white/5 rounded-xl p-4 text-[11px] outline-none" placeholder="Heartbeat pulse, nerve crackle..." />
                <div className="p-4 bg-[#14141c] border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400">Engagement FX</span>
                    <button onClick={() => setProject({ ...project, audioConfig: { ...project.audioConfig, engagementSfx: !project.audioConfig.engagementSfx } })} className={`w-10 h-5 rounded-full relative transition-all ${project.audioConfig.engagementSfx ? 'bg-cyan-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${project.audioConfig.engagementSfx ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  <p className="text-[7px] text-slate-600 uppercase leading-relaxed">Auto-places transitions and emphasis pops.</p>
                </div>
                <button onClick={handleBakeSFX} disabled={!activeScene.sfxPrompt} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase disabled:opacity-20 border border-white/10">Bake Scene FX</button>
                <div className="space-y-2">
                  <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest"><span>SFX Intensity</span><span>{project.audioConfig.sfxIntensity}%</span></div>
                  <input type="range" min="0" max="100" value={project.audioConfig.sfxIntensity} onChange={e => setProject({ ...project, audioConfig: { ...project.audioConfig, sfxIntensity: parseInt(e.target.value) } })} className="w-full h-1 bg-white/10 appearance-none accent-slate-500 rounded-full" />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ══════════════════════════════════════════
            PREVIEW — fully connected to playhead
            previewFrame updates on every currentTime change
            previewNarration synced to playhead position
            ══════════════════════════════════════════ */}
        <div className="flex-1 bg-[#050507] relative flex flex-col items-center justify-center p-4 overflow-hidden z-10">
          <div className="flex flex-col items-center w-full h-full">
            <div className={`relative flex-1 bg-black border border-white/5 rounded-2xl overflow-hidden flex flex-col max-h-full max-w-full shadow-[0_0_60px_rgba(0,0,0,0.8)] ${project.aspectRatio === '9:16' ? 'aspect-[9/16] h-full w-auto' : 'aspect-video w-full h-auto max-w-4xl'}`}>
              <div className="flex-1 relative overflow-hidden flex items-center justify-center">

                {/* ── Frame-accurate preview ── */}
                {previewFrame?.videoUrl ? (
                  <video key={previewFrame.videoUrl} src={previewFrame.videoUrl} className="w-full h-full object-contain" autoPlay loop muted />
                ) : previewFrame?.imageUrl ? (
                  <img key={previewFrame.imageUrl} src={previewFrame.imageUrl} className="w-full h-full object-contain" />
                ) : (
                  <div className="opacity-5 animate-pulse flex flex-col items-center gap-4">
                    <i className="fas fa-cube text-[60px]"></i>
                    <span className="text-[9px] font-black uppercase tracking-[1em]">Director Monitor</span>
                  </div>
                )}

                {/* ── Captions synced to playhead ── */}
                {project.captionConfig.showCaptions && previewNarration && (
                  <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center pointer-events-none z-20">
                    <div className="px-6 py-3 rounded-2xl text-center font-black border border-white/5 backdrop-blur-md max-w-xs" style={{
                      fontFamily: project.captionConfig.fontFamily,
                      color: project.captionConfig.color,
                      backgroundColor: project.captionConfig.showBackground ? project.captionConfig.backgroundColor : 'transparent',
                      fontSize: `clamp(2px, 4vw, ${parseInt(project.captionConfig.fontSize) / 2}px)`,
                      textTransform: project.captionConfig.isUppercase ? 'uppercase' : 'none',
                      textShadow: project.captionConfig.textEffect === 'shadow' ? '2px 2px 8px rgba(0,0,0,0.9)' : project.captionConfig.textEffect === 'glow' ? `0 0 12px ${project.captionConfig.color}` : 'none'
                    }}>{previewNarration}</div>
                  </div>
                )}

                {/* Scene indicator */}
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 z-20">
                  <span className="text-[7px] font-mono text-slate-400">
                    {project.scenes.indexOf(previewScene) + 1}/{project.scenes.length}
                  </span>
                </div>

                {/* Loading overlay */}
                {projectStatus !== ProjectStatus.IDLE && (
                  <div className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-3xl z-50 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">{projectStatus.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Playback controls */}
            <div className="w-full max-w-md px-4 mt-5 z-50">
              <div className="flex flex-col gap-3 bg-[#0a0a0f]/98 backdrop-blur-3xl px-6 py-4 rounded-3xl border border-white/10 shadow-2xl">
                <input type="range" min="0" max={totalLength} step="0.01" value={currentTime} onChange={e => handleSeek(parseFloat(e.target.value))} className="w-full h-1 appearance-none cursor-pointer accent-cyan-400 bg-white/10 rounded-full" />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleSeek(currentTime - 5)} className="text-slate-600 hover:text-white transition-all"><i className="fas fa-backward-step text-sm"></i></button>
                      <button onClick={() => setIsPlayingSequence(!isPlayingSequence)} className="w-11 h-11 bg-cyan-400 text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                        <i className={`fas ${isPlayingSequence ? 'fa-pause' : 'fa-play'} text-base`}></i>
                      </button>
                      <button onClick={() => handleSeek(currentTime + 5)} className="text-slate-600 hover:text-white transition-all"><i className="fas fa-forward-step text-sm"></i></button>
                    </div>
                    <div className="flex items-center gap-4 opacity-60">
                      <button onClick={handleUndo} disabled={!historyPast.length} className={`flex items-center gap-1 transition-all ${historyPast.length ? 'text-slate-400 hover:text-white' : 'text-slate-800 pointer-events-none'}`}>
                        <i className="fas fa-rotate-left text-[9px]"></i><span className="text-[7px] font-black uppercase tracking-widest">Undo</span>
                      </button>
                      <button onClick={handleRedo} disabled={!historyFuture.length} className={`flex items-center gap-1 transition-all ${historyFuture.length ? 'text-slate-400 hover:text-white' : 'text-slate-800 pointer-events-none'}`}>
                        <span className="text-[7px] font-black uppercase tracking-widest">Redo</span><i className="fas fa-rotate-right text-[9px]"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-black text-cyan-400">{currentTime.toFixed(2)}s</span>
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">/ {totalLength.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Timeline resize handle */}
      <div
        onMouseDown={handleResizeTimelineStart}
        onClick={e => { if (!isResizingTimeline) handleToggleMinimize(); }}
        className={`h-4 w-full bg-[#0a0a0f] hover:bg-cyan-400/20 cursor-row-resize transition-all flex items-center justify-center group z-50 shrink-0 border-t border-b border-white/5 ${isResizingTimeline ? 'bg-cyan-400/30' : ''}`}
      >
        <div className={`w-10 h-1 rounded-full bg-white/10 group-hover:bg-cyan-400/60 transition-all ${isResizingTimeline ? 'bg-cyan-400 w-16' : ''}`} />
      </div>

      {/* Timeline */}
      <footer className="bg-[#08080c] z-40 shrink-0 overflow-hidden" style={{ height: timelineHeight }}>
        <Timeline
          scenes={project.scenes}
          extraTracks={project.extraTracks}
          onSplitClip={handleSplitClip}
          activeSceneId={activeSceneId}
          onSelectScene={id => { setActiveSceneId(id); const s = project.scenes.find(sc => sc.id === id); if (s) { let acc = 0; for (const sc of project.scenes) { if (sc.id === id) { handleSeek(acc); break; } acc += sc.duration || project.sceneDuration; } } }}
          onOpenFrameEditor={() => setTimelineMode('frame')}
          onAddScene={() => {
            saveToHistory();
            setProject(p => ({
              ...p, scenes: [...p.scenes, {
                id: 'sc-' + Date.now(), order: p.scenes.length, mediaType: 'ai',
                aiPrompt: '', startFramePrompt: '', targetFramePrompt: '', videoPrompt: '',
                stockQuery: '', startImageUrl: '', targetImageUrl: '', videoUrl: '',
                frames: [], narrationChunk: '', status: 'ready',
                duration: project.sceneDuration, narrationDuration: project.sceneDuration, sfxPrompt: ''
              }]
            }));
          }}
          onRemoveScene={handleRemoveScene}
          onUpdateSceneDuration={(id, dur) => updateScene(id, { duration: dur })}
          onUpdateNarrationDuration={(id, dur) => updateScene(id, { narrationDuration: dur })}
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
