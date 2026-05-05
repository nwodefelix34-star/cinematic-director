import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Scene, AudioClip } from '../types';

interface TimelineProps {
  scenes: Scene[];
  extraTracks: AudioClip[][];
  activeSceneId: string;
  onSelectScene: (id: string) => void;
  onOpenFrameEditor: () => void;
  onAddScene: () => void;
  onRemoveScene: (id: string) => void;
  onUpdateSceneDuration: (id: string, duration: number) => void;
  onUpdateNarrationDuration: (id: string, duration: number) => void;
  onSplitClip: (sceneId: string, clipIndex: number, time: number) => void;
  onUpdateGlobalClip: (trackIndex: number, clipId: string, updates: Partial<AudioClip>, finalize?: boolean) => void;
  onAddGlobalClip: (trackIndex: number, startTime: number) => void;
  onRemoveGlobalClip: (trackIndex: number, clipId: string) => void;
  onPreviewNarration: (url: string) => void;
  onBakeNarration: (id: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  defaultDuration: number;
  totalProjectDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

interface DragState {
  id: string;
  type: 'visual' | 'narration' | 'extra' | 'playhead';
  mode: 'move' | 'resize-left' | 'resize-right';
  trackIndex?: number;
  startX: number;
  startDuration: number;
  startStartTime?: number;
}

const LABEL_WIDTH = 52;
const MIN_PPS = 14;
const MAX_PPS = 120;
const DEFAULT_PPS = 36;

const Timeline: React.FC<TimelineProps> = ({
  scenes,
  extraTracks,
  activeSceneId,
  onSelectScene,
  onOpenFrameEditor,
  onAddScene,
  onRemoveScene,
  onUpdateSceneDuration,
  onUpdateNarrationDuration,
  onSplitClip,
  onUpdateGlobalClip,
  onAddGlobalClip,
  onRemoveGlobalClip,
  onPreviewNarration,
  onBakeNarration,
  onMinimize,
  isMinimized,
  defaultDuration,
  totalProjectDuration,
  currentTime,
  onSeek,
}) => {
  const [pps, setPps] = useState(DEFAULT_PPS); // pixels per second
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'select' | 'split' | 'trim'>('select');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const totalWidth = Math.max(totalProjectDuration, 15) * pps + LABEL_WIDTH + 120;

  // ── Ruler tick calculation ──
  const getRulerTicks = () => {
    const interval = pps >= 60 ? 0.5 : pps >= 30 ? 1 : pps >= 14 ? 2 : 5;
    const count = Math.ceil(totalProjectDuration / interval) + 2;
    return Array.from({ length: count }, (_, i) => i * interval);
  };

  // ── Drag handlers ──
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    id: string,
    type: DragState['type'],
    mode: DragState['mode'],
    startDuration: number,
    startStartTime?: number,
    trackIndex?: number
  ) => {
    e.stopPropagation();
    dragRef.current = { id, type, mode, startX: e.clientX, startDuration, startStartTime, trackIndex };
    setIsDragging(true);
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [pps]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const { type, mode, id, startDuration, startStartTime, trackIndex } = dragRef.current;

      if (type === 'playhead') {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;
        const relX = e.clientX - rect.left + scrollLeft - LABEL_WIDTH;
        const newTime = Math.max(0, Math.min(totalProjectDuration, relX / pps));
        onSeek(newTime);
        return;
      }

      const deltaS = deltaX / pps;

      if (type === 'visual') {
        const newDur = Math.max(0.5, startDuration + (mode === 'resize-left' ? -deltaS : deltaS));
        onUpdateSceneDuration(id, newDur);
      } else if (type === 'narration') {
        const newDur = Math.max(0.5, startDuration + (mode === 'resize-left' ? -deltaS : deltaS));
        onUpdateNarrationDuration(id, newDur);
      } else if (type === 'extra' && trackIndex !== undefined && startStartTime !== undefined) {
        if (mode === 'move') {
          onUpdateGlobalClip(trackIndex, id, { startTime: Math.max(0, startStartTime + deltaS) });
        } else if (mode === 'resize-right') {
          onUpdateGlobalClip(trackIndex, id, { duration: Math.max(0.5, startDuration + deltaS) });
        } else if (mode === 'resize-left') {
          const ps = startStartTime + deltaS;
          const pd = startDuration - deltaS;
          if (pd > 0.5 && ps >= 0) onUpdateGlobalClip(trackIndex, id, { startTime: ps, duration: pd });
        }
      }
    });
  }, [pps, onSeek, onUpdateSceneDuration, onUpdateNarrationDuration, onUpdateGlobalClip, totalProjectDuration]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      const { type, id, trackIndex } = dragRef.current;
      if (type === 'extra' && trackIndex !== undefined) {
        onUpdateGlobalClip(trackIndex, id, {}, true);
      }
    }
    dragRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = 'default';
    cancelAnimationFrame(rafRef.current);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, onUpdateGlobalClip]);

  // ── Click on ruler to seek ──
  const handleRulerClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const relX = e.clientX - rect.left + scrollLeft - LABEL_WIDTH;
    onSeek(Math.max(0, Math.min(totalProjectDuration, relX / pps)));
  };

  // ── Auto-scroll playhead into view ──
  useEffect(() => {
    if (!containerRef.current) return;
    const playheadX = LABEL_WIDTH + currentTime * pps;
    const { scrollLeft, clientWidth } = containerRef.current;
    const margin = 80;
    if (playheadX > scrollLeft + clientWidth - margin) {
      containerRef.current.scrollLeft = playheadX - clientWidth + margin + 40;
    } else if (playheadX < scrollLeft + LABEL_WIDTH + margin) {
      containerRef.current.scrollLeft = Math.max(0, playheadX - LABEL_WIDTH - margin);
    }
  }, [currentTime, pps]);

  // ── Scene start time calculator ──
  const getSceneStart = (sceneId: string) => {
    let acc = 0;
    for (const s of scenes) {
      if (s.id === sceneId) return acc;
      acc += s.duration || defaultDuration;
    }
    return 0;
  };

  // ── Playhead X position ──
  const playheadX = LABEL_WIDTH + currentTime * pps;

  const ticks = getRulerTicks();

  return (
    <div className={`flex flex-col h-full bg-[#08080c] select-none border-t border-white/5 ${isDragging ? 'cursor-grabbing' : ''}`}>

      {/* ── TOP BAR: tools + zoom ── */}
      <div className="h-9 border-b border-white/5 bg-[#0a0a0f] flex items-center px-3 justify-between shrink-0 gap-4">

        {/* Left: Add + Tools */}
        <div className="flex items-center gap-3">
          <button
            onClick={onAddScene}
            className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all"
          >
            <i className="fas fa-plus-circle text-[10px]"></i> Clip
          </button>

          <div className="w-px h-4 bg-white/10" />

          {/* Tool selector */}
          {[
            { id: 'select', icon: 'fa-arrow-pointer', label: 'Select' },
            { id: 'split', icon: 'fa-scissors', label: 'Split' },
            { id: 'trim', icon: 'fa-compress-alt', label: 'Trim' },
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id as any)}
              title={tool.label}
              className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] transition-all ${selectedTool === tool.id ? 'bg-cyan-500 text-black' : 'text-slate-600 hover:text-white'}`}
            >
              <i className={`fas ${tool.icon}`}></i>
            </button>
          ))}

          <div className="w-px h-4 bg-white/10" />

          {/* Active scene actions */}
          {activeSceneId && (
            <button
              onClick={() => {
                const sceneStart = getSceneStart(activeSceneId);
                const localTime = currentTime - sceneStart;
                onSplitClip(activeSceneId, 0, localTime);
              }}
              className="text-[8px] font-black uppercase text-slate-500 hover:text-white tracking-widest flex items-center gap-1 transition-all"
            >
              <i className="fas fa-scissors text-[9px]"></i> Split
            </button>
          )}
        </div>

        {/* Right: Zoom + time */}
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-mono text-slate-600">{currentTime.toFixed(2)}s</span>
          <span className="text-slate-700 text-[8px]">/</span>
          <span className="text-[8px] font-mono text-cyan-500">{totalProjectDuration.toFixed(1)}s</span>

          <div className="w-px h-4 bg-white/10" />

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button onClick={() => setPps(p => Math.max(MIN_PPS, p - 8))} className="text-slate-600 hover:text-white text-[9px] w-5 h-5 flex items-center justify-center">
              <i className="fas fa-minus"></i>
            </button>
            <input
              type="range" min={MIN_PPS} max={MAX_PPS} value={pps}
              onChange={e => setPps(Number(e.target.value))}
              className="w-16 h-1 accent-cyan-400 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
            <button onClick={() => setPps(p => Math.min(MAX_PPS, p + 8))} className="text-slate-600 hover:text-white text-[9px] w-5 h-5 flex items-center justify-center">
              <i className="fas fa-plus"></i>
            </button>
          </div>

          {onMinimize && (
            <button onClick={onMinimize} className="w-6 h-6 flex items-center justify-center text-slate-700 hover:text-cyan-400 transition-colors">
              <i className={`fas fa-chevron-${isMinimized ? 'up' : 'down'} text-[8px]`}></i>
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div ref={containerRef} className="flex-1 overflow-auto relative" style={{ cursor: isDragging ? 'grabbing' : 'default' }}>
          <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>

            {/* ── RULER ── */}
            <div
              ref={rulerRef}
              onClick={handleRulerClick}
              className="sticky top-0 z-50 bg-[#0a0a0f] border-b border-white/10 flex items-end cursor-pointer"
              style={{ height: 24, width: totalWidth }}
            >
              {/* Label spacer */}
              <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />

              {/* Ticks */}
              <div className="relative flex-1 h-full">
                {ticks.map(t => {
                  const x = t * pps;
                  const isMain = Number.isInteger(t);
                  return (
                    <div
                      key={t}
                      className="absolute bottom-0 flex flex-col items-center"
                      style={{ left: x }}
                    >
                      <div className={`${isMain ? 'h-3 bg-white/20' : 'h-1.5 bg-white/10'} w-px`} />
                      {isMain && (
                        <span className="text-[7px] font-mono text-slate-600 absolute bottom-3 -translate-x-1/2">{t}s</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── PLAYHEAD ── */}
            <div
              className="absolute top-0 bottom-0 z-[60] pointer-events-none"
              style={{ left: playheadX, top: 0 }}
            >
              {/* Head diamond */}
              <div
                className="absolute -top-0 left-1/2 -translate-x-1/2 pointer-events-auto cursor-grab active:cursor-grabbing"
                onMouseDown={e => handleMouseDown(e, 'playhead', 'playhead', 'move', 0)}
              >
                <div
                  style={{
                    width: 10, height: 10,
                    background: '#22d3ee',
                    clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    marginTop: 14
                  }}
                />
              </div>
              {/* Line */}
              <div
                className="absolute top-6 bottom-0 w-px bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
                style={{ left: 0 }}
              />
            </div>

            {/* ── TRACKS ── */}
            <div className="flex flex-col gap-px pt-1 pb-6">

              {/* ══ VISUAL TRACK ══ */}
              <TrackRow label="Visual" icon="fa-film" iconColor="text-cyan-400">
                {scenes.map(scene => {
                  const dur = scene.duration || defaultDuration;
                  const isActive = activeSceneId === scene.id;
                  const thumb = scene.frames?.[0]?.imageUrl || scene.clips?.[0]?.frames?.[0]?.imageUrl;

                  return (
                    <div
                      key={scene.id}
                      className={`relative group h-14 rounded-lg border overflow-hidden shrink-0 transition-all ${
                        isActive
                          ? 'border-cyan-400 ring-1 ring-cyan-400/30'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                      style={{ width: dur * pps, minWidth: 32 }}
                      onClick={() => {
                        onSelectScene(scene.id);
                        if (selectedTool === 'split') {
                          const sceneStart = getSceneStart(scene.id);
                          const localTime = currentTime - sceneStart;
                          onSplitClip(scene.id, 0, localTime);
                        }
                      }}
                    >
                      {/* Thumbnail filmstrip */}
                      {thumb ? (
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: Math.max(1, Math.floor(dur * pps / 40)) }).map((_, i) => (
                            <img
                              key={i}
                              src={thumb}
                              className="h-full object-cover flex-shrink-0 opacity-70"
                              style={{ width: Math.min(40, dur * pps) }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
                          <i className="fas fa-image text-white/10 text-lg"></i>
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/30" />

                      {/* Duration badge */}
                      <div className="absolute bottom-1 left-1.5 text-[6px] font-mono text-white/70 bg-black/50 px-1 rounded z-10">
                        {dur.toFixed(1)}s
                      </div>

                      {/* Scene number */}
                      <div className="absolute top-1 left-1.5 text-[6px] font-black text-white/50 z-10">
                        {scenes.indexOf(scene) + 1}
                      </div>

                      {/* Remove button */}
                      {scenes.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveScene(scene.id); }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"
                        >
                          <i className="fas fa-times text-[7px] text-white"></i>
                        </button>
                      )}

                      {/* Left trim handle */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, scene.id, 'visual', 'resize-left', dur); }}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-all z-20 flex items-center justify-center hover:bg-cyan-400/30"
                      >
                        <div className="w-px h-6 bg-cyan-400/60 rounded-full" />
                      </div>

                      {/* Right trim handle */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, scene.id, 'visual', 'resize-right', dur); }}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-all z-20 flex items-center justify-center hover:bg-cyan-400/30"
                      >
                        <div className="w-px h-6 bg-cyan-400/60 rounded-full" />
                      </div>
                    </div>
                  );
                })}
              </TrackRow>

              {/* ══ VOICE TRACK ══ */}
              <TrackRow label="Voice" icon="fa-microphone-lines" iconColor="text-amber-400">
                {scenes.map(scene => {
                  const dur = scene.narrationDuration || scene.duration || defaultDuration;
                  const hasAudio = !!scene.narrationAudioUrl;
                  const isActive = activeSceneId === scene.id;

                  return (
                    <div
                      key={`v-${scene.id}`}
                      className={`relative group h-10 rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'border-amber-400/60 bg-amber-500/10'
                          : 'border-white/10 bg-white/3 hover:border-white/20'
                      }`}
                      style={{ width: dur * pps, minWidth: 28 }}
                      onClick={() => onSelectScene(scene.id)}
                    >
                      {/* Waveform visualization */}
                      {hasAudio ? (
                        <div className="absolute inset-0 flex items-center px-1 gap-px">
                          {Array.from({ length: Math.max(4, Math.floor(dur * pps / 4)) }).map((_, i) => {
                            const h = 20 + Math.sin(i * 0.8) * 12 + Math.cos(i * 1.3) * 8;
                            return (
                              <div
                                key={i}
                                className="flex-1 bg-amber-400/60 rounded-full"
                                style={{ height: `${Math.max(10, Math.min(80, h))}%` }}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            onClick={e => { e.stopPropagation(); onBakeNarration(scene.id); }}
                            className="text-[7px] font-black uppercase text-slate-600 hover:text-amber-400 transition-all flex items-center gap-1"
                          >
                            <i className="fas fa-plus text-[8px]"></i>
                            {dur * pps > 50 ? 'Add Voice' : '+'}
                          </button>
                        </div>
                      )}

                      {/* Play button if has audio */}
                      {hasAudio && (
                        <button
                          onClick={e => { e.stopPropagation(); onPreviewNarration(scene.narrationAudioUrl!); }}
                          className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                        >
                          <i className="fas fa-play text-[6px] text-amber-400"></i>
                        </button>
                      )}

                      {/* Left trim */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, scene.id, 'narration', 'resize-left', dur); }}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 z-20 flex items-center justify-center hover:bg-amber-400/20"
                      >
                        <div className="w-px h-4 bg-amber-400/50 rounded-full" />
                      </div>

                      {/* Right trim */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, scene.id, 'narration', 'resize-right', dur); }}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 z-20 flex items-center justify-center hover:bg-amber-400/20"
                      >
                        <div className="w-px h-4 bg-amber-400/50 rounded-full" />
                      </div>
                    </div>
                  );
                })}
              </TrackRow>

              {/* ══ SCORE + FX TRACKS ══ */}
              {[0, 1].map(trackIdx => {
                const trackColor = trackIdx === 0 ? 'text-purple-400' : 'text-blue-400';
                const clipColor = trackIdx === 0
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-300';
                const label = trackIdx === 0 ? 'Score' : 'FX';
                const icon = trackIdx === 0 ? 'fa-music' : 'fa-bolt-lightning';

                return (
                  <div key={`track-${trackIdx}`} className="flex items-center" style={{ height: 36 }}>
                    {/* Label */}
                    <div
                      style={{ width: LABEL_WIDTH, flexShrink: 0 }}
                      className={`flex items-center gap-1.5 px-2 ${trackColor}`}
                    >
                      <i className={`fas ${icon} text-[8px]`}></i>
                      <span className="text-[7px] font-black uppercase tracking-wider opacity-70">{label}</span>
                    </div>

                    {/* Track area */}
                    <div
                      className="relative h-full bg-white/2 rounded border border-white/5"
                      style={{ width: Math.max(totalProjectDuration, 15) * pps + 120 }}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        onAddGlobalClip(trackIdx, x / pps);
                      }}
                    >
                      {extraTracks[trackIdx]?.map(clip => (
                        <div
                          key={clip.id}
                          className={`absolute top-1 bottom-1 rounded-lg border flex items-center px-2 cursor-grab group transition-all ${clipColor}`}
                          style={{ left: clip.startTime * pps, width: Math.max(30, clip.duration * pps) }}
                          onMouseDown={e => handleMouseDown(e, clip.id, 'extra', 'move', clip.duration, clip.startTime, trackIdx)}
                        >
                          {/* Waveform for audio clips */}
                          {clip.audioUrl && (
                            <div className="absolute inset-0 flex items-center px-1 gap-px overflow-hidden">
                              {Array.from({ length: Math.max(3, Math.floor(clip.duration * pps / 5)) }).map((_, i) => (
                                <div key={i} className="flex-1 bg-current opacity-30 rounded-full" style={{ height: `${30 + Math.sin(i) * 20}%` }} />
                              ))}
                            </div>
                          )}

                          <span className="text-[6px] font-black uppercase truncate relative z-10 opacity-80">{clip.content}</span>

                          {/* Remove */}
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onRemoveGlobalClip(trackIdx, clip.id); }}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"
                          >
                            <i className="fas fa-times text-[6px] text-white"></i>
                          </button>

                          {/* Left trim */}
                          <div
                            onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, clip.id, 'extra', 'resize-left', clip.duration, clip.startTime, trackIdx); }}
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
                          />
                          {/* Right trim */}
                          <div
                            onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, clip.id, 'extra', 'resize-right', clip.duration, clip.startTime, trackIdx); }}
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
                          />
                        </div>
                      ))}

                      {/* Add hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[7px] text-white/20 uppercase tracking-widest">Click to add</span>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Reusable track row ──
const TrackRow: React.FC<{
  label: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
}> = ({ label, icon, iconColor, children }) => (
  <div className="flex items-center" style={{ minHeight: 60 }}>
    <div
      style={{ width: LABEL_WIDTH, flexShrink: 0 }}
      className={`flex flex-col items-center justify-center gap-1 py-2 ${iconColor}`}
    >
      <i className={`fas ${icon} text-[9px]`}></i>
      <span className="text-[6px] font-black uppercase tracking-wider opacity-60">{label}</span>
    </div>
    <div className="flex items-center gap-1 flex-1 h-full py-1">
      {children}
    </div>
  </div>
);

export default Timeline;
