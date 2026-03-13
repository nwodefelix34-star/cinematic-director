import React, { useRef, useState, useEffect } from 'react';
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
  onSeek
}) => {
  const PIXELS_PER_SECOND = 28; // Reduced from 44 for more compact horizontal view
  const LABEL_WIDTH = 80; // Reduced from 96
  const dragRef = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    if (mode === 'move') document.body.style.cursor = 'grabbing';
    else document.body.style.cursor = 'ew-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const deltaX = e.clientX - dragRef.current.startX;
    
    const { type, mode, id, startDuration, startStartTime, trackIndex } = dragRef.current;

    if (type === 'playhead') {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const relativeX = e.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, Math.min(totalProjectDuration, (relativeX - LABEL_WIDTH) / PIXELS_PER_SECOND));
      onSeek(newTime);
      return;
    }

    const deltaSeconds = deltaX / PIXELS_PER_SECOND;

    if (type === 'visual' || type === 'narration') {
      const multiplier = mode === 'resize-left' ? -1 : 1;
      const newVal = Math.max(0.4, startDuration + (deltaSeconds * multiplier));
      if (type === 'visual') onUpdateSceneDuration(id, newVal);
      else onUpdateNarrationDuration(id, newVal);
    } 
    else if (type === 'extra' && trackIndex !== undefined && startStartTime !== undefined) {
      if (mode === 'move') {
        onUpdateGlobalClip(trackIndex, id, { startTime: Math.max(0, startStartTime + deltaSeconds) });
      } else if (mode === 'resize-right') {
        onUpdateGlobalClip(trackIndex, id, { duration: Math.max(0.1, startDuration + deltaSeconds) });
      } else if (mode === 'resize-left') {
        const potentialStart = startStartTime + deltaSeconds;
        const potentialDuration = startDuration - deltaSeconds;
        if (potentialDuration > 0.1 && potentialStart >= 0) {
          onUpdateGlobalClip(trackIndex, id, { 
            startTime: potentialStart, 
            duration: potentialDuration 
          });
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (dragRef.current) {
      const { type, id, trackIndex } = dragRef.current;
      if (type === 'extra' && trackIndex !== undefined) {
        onUpdateGlobalClip(trackIndex, id, {}, true);
      }
    }
    dragRef.current = null;
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };

  return (
    <div className={`flex flex-col h-full bg-[#08080c] transition-all select-none border-t border-white/5 ${isDragging ? 'pointer-events-auto' : ''}`}>
      {/* Timeline Controls */}
      <div className="h-8 border-b border-white/5 bg-[#0a0a0f] flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={onAddScene} className="text-[8px] font-black text-slate-500 hover:text-[#3ab7bf] uppercase tracking-widest transition-all flex items-center gap-2 group">
            <i className="fas fa-plus-circle text-[#3ab7bf] text-[10px] group-hover:scale-110 transition-transform"></i> Clip
          </button>
          <div className="h-2 w-[1px] bg-white/10 hidden sm:block"></div>
          <div className="hidden sm:flex text-[7px] font-black text-slate-700 uppercase tracking-widest items-center gap-2">
            <i className="fas fa-layer-group text-[#3ab7bf] text-[9px]"></i> Tracks
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[8px] font-mono text-slate-600 tracking-tighter uppercase font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
            <span className="text-[#3ab7bf] mr-1">{totalProjectDuration.toFixed(1)}s</span>
          </div>
          {onMinimize && (
            <button onClick={onMinimize} className="w-6 h-6 flex items-center justify-center text-slate-700 hover:text-[#3ab7bf] transition-colors">
              <i className={`fas fa-chevron-${isMinimized ? 'up' : 'down'} text-[8px]`}></i>
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto custom-scroll px-3 sm:px-4 py-3 relative">
          <div className="flex flex-col gap-4 min-w-max relative pb-4">
            
            {/* Playhead Indicator */}
            <div 
              className="absolute top-0 bottom-0 w-[1px] bg-[#3ab7bf] shadow-[0_0_8px_rgba(58,183,191,0.4)] z-[100] transition-transform duration-100 ease-linear"
              style={{ transform: `translateX(${LABEL_WIDTH + (currentTime * PIXELS_PER_SECOND)}px)` }}
            >
              <div 
                onMouseDown={(e) => handleMouseDown(e, 'playhead', 'playhead', 'move', 0)}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 flex items-start justify-center cursor-grab active:cursor-grabbing group"
              >
                <div className="w-2.5 h-2.5 bg-[#3ab7bf] rounded-sm rotate-45 shadow-lg group-hover:scale-110 transition-transform"></div>
              </div>
            </div>

            {/* Visual Master Track */}
            <div className="flex items-center gap-3">
               <div className="w-16 shrink-0 text-[6px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                 <i className="fas fa-video-camera text-[#3ab7bf] text-[8px]"></i> Visual
               </div>
               <div className="flex items-center">
                  {scenes.map((scene, idx) => {
                    const dur = scene.duration || defaultDuration;
                    const isActive = activeSceneId === scene.id;
                    return (
                      <div 
                        key={scene.id} 
                        className={`relative group h-12 sm:h-16 rounded-lg border transition-all overflow-hidden flex items-center justify-center cursor-pointer shrink-0
                          ${isActive ? 'border-[#3ab7bf] bg-[#3ab7bf]/10' : 'border-[#1a1a24] bg-[#111116] hover:border-slate-700'}
                        `}
                        style={{ width: `${dur * PIXELS_PER_SECOND}px`, minWidth: '40px' }}
                        onClick={(e) => {

  const rect = e.currentTarget.getBoundingClientRect()
  const clickX = e.clientX - rect.left

  const frameCount =
  scene.clips?.flatMap(c => c.frames).length ||
  scene.frames?.length ||
  1
  const frameWidth = rect.width / frameCount

  const clickedFrame = Math.floor(clickX / frameWidth)

  onSelectScene(scene.id)

  if (scene.frames && scene.frames.length > 0) {
    window.dispatchEvent(
      new CustomEvent("selectFrame", {
        detail: clickedFrame
      })
    )
  }
                          
onOpenFrameEditor()
                          
}}
                      >
                        <div onMouseDown={(e) => handleMouseDown(e, scene.id, 'visual', 'resize-left', dur)} className="absolute left-0 top-0 bottom-0 w-2 hover:bg-[#3ab7bf]/30 cursor-ew-resize transition-all z-20 opacity-0 group-hover:opacity-100"></div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (scenes.length > 1) onRemoveScene(scene.id);
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-30 scale-75"
                        >
                          <i className="fas fa-times text-[8px]"></i>
                        </button>

                        {(scene.clips && scene.clips.length > 0) ? (
  <div className="absolute inset-0 flex">

    {scene.clips.flatMap(clip => clip.frames).map((frame, i) => (

      <div
        key={frame.id}
        className="h-full"
        style={{
          width: `${100 / scene.clips.flatMap(c => c.frames).length}%`
        }}
      >
        {frame.imageUrl && (
          <img
            src={frame.imageUrl}
            className="w-full h-full object-cover opacity-60 pointer-events-none"
          />
        )}
      </div>

    ))}

  </div>
) : (
                        
  <div className="opacity-10 scale-75">
    <i className="fas fa-image text-lg"></i>
  </div>
)}

                      {(scene.clips && scene.clips.length > 0) ? (
  <div className="absolute inset-0 flex">

    {scene.clips.flatMap(clip => clip.frames).map((frame, i) => (

      <div
        key={frame.id}
        className="h-full"
        style={{
          width: `${100 / scene.clips.flatMap(c => c.frames).length}%`
        }}
      >
        {frame.imageUrl && (
          <img
            src={frame.imageUrl}
            className="w-full h-full object-cover opacity-60 pointer-events-none"
          />
        )}
      </div>

    ))}

  </div>
) : (
                        
                        <div className="absolute bottom-0.5 left-1 px-1 bg-black/70 rounded text-[6px] text-white font-black z-10 pointer-events-none">
                          {dur.toFixed(1)}s
                        </div>

                        <div onMouseDown={(e) => handleMouseDown(e, scene.id, 'visual', 'resize-right', dur)} className="absolute right-0 top-0 bottom-0 w-2 hover:bg-[#3ab7bf]/60 cursor-ew-resize transition-all z-20 flex items-center justify-center">
                           <div className="w-[1px] h-4 bg-[#3ab7bf]/50 rounded-full"></div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Narration Master Track */}
            <div className="flex items-center gap-3">
               <div className="w-16 shrink-0 text-[6px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                 <i className="fas fa-microphone-lines text-amber-500 text-[8px]"></i> Voice
               </div>
               <div className="flex items-center">
                  {scenes.map((scene) => {
                    const dur = scene.narrationDuration || scene.duration || defaultDuration;
                    const isActive = activeSceneId === scene.id;
                    return (
                      <div 
                        key={`n-${scene.id}`} 
                        className={`relative group h-8 sm:h-10 rounded-lg border flex flex-col justify-center px-2 transition-all cursor-pointer overflow-hidden shrink-0
                          ${isActive ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[#111116] border-[#1a1a24] hover:border-slate-800'}
                        `}
                        style={{ width: `${dur * PIXELS_PER_SECOND}px`, minWidth: '30px' }}
                        onClick={() => onSelectScene(scene.id)}
                      >
                        <div onMouseDown={(e) => handleMouseDown(e, scene.id, 'narration', 'resize-left', dur)} className="absolute left-0 top-0 bottom-0 w-2 hover:bg-amber-500/30 cursor-ew-resize transition-all z-20 opacity-0 group-hover:opacity-100"></div>

                        <div className="flex items-center gap-1 relative z-10 overflow-hidden">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (scene.narrationAudioUrl) onPreviewNarration(scene.narrationAudioUrl);
                              else onBakeNarration(scene.id);
                            }}
                            className={`w-5 h-5 rounded-md flex items-center justify-center bg-black/40 border border-white/5 transition-all hover:scale-105 shrink-0 ${scene.narrationAudioUrl ? 'text-amber-500' : 'text-slate-600 hover:text-amber-500'}`}
                          >
                            <i className={`fas ${scene.narrationAudioUrl ? 'fa-play' : 'fa-plus'} text-[8px]`}></i>
                          </button>
                        </div>
                        
                        <div onMouseDown={(e) => handleMouseDown(e, scene.id, 'narration', 'resize-right', dur)} className="absolute right-0 top-0 bottom-0 w-2 hover:bg-amber-500/60 cursor-ew-resize transition-all z-20 flex items-center justify-center">
                           <div className="w-[1px] h-3 bg-amber-500/40 rounded-full"></div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Extra Tracks */}
            <div className="flex flex-col gap-2">
              {[0, 1].map((trackIndex) => (
                <div className="flex items-center gap-3" key={`track-${trackIndex}`}>
                  <div className="w-16 shrink-0 text-[6px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <i className={`fas ${trackIndex === 0 ? 'fa-music' : 'fa-bolt-lightning'} text-[8px]`}></i> {trackIndex === 0 ? 'Score' : `FX`}
                  </div>
                  <div className="h-8 relative flex-1 bg-black/40 rounded-lg border border-white/5" style={{ width: `${Math.max(totalProjectDuration, 15) * PIXELS_PER_SECOND + 100}px` }}>
                    <button onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        onAddGlobalClip(trackIndex, clickX / PIXELS_PER_SECOND);
                      }}
                      className="absolute inset-0 z-0 hover:bg-white/5 cursor-crosshair transition-all rounded-lg"
                    />
                    {extraTracks[trackIndex].map((clip) => (
                      <div 
                        key={clip.id}
                        className={`absolute group h-full border rounded-lg flex items-center px-3 cursor-move transition-all
                          ${clip.type === 'music' ? 'bg-[#4c1d95]/40 border-[#7c3aed]/50 text-white' : 'bg-[#1e293b]/60 border-[#334155] text-slate-300'}
                        `}
                        style={{ left: `${clip.startTime * PIXELS_PER_SECOND}px`, width: `${clip.duration * PIXELS_PER_SECOND}px`, minWidth: '30px' }}
                        onMouseDown={(e) => handleMouseDown(e, clip.id, 'extra', 'move', clip.duration, clip.startTime, trackIndex)}
                      >
                        <div onMouseDown={(e) => handleMouseDown(e, clip.id, 'extra', 'resize-left', clip.duration, clip.startTime, trackIndex)} className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/10 cursor-ew-resize z-20 opacity-0 group-hover:opacity-100"></div>
                        
                        <div className="flex items-center gap-1 truncate pointer-events-none scale-90">
                          <span className="text-[6px] font-black truncate uppercase">{clip.content}</span>
                        </div>
                        
                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemoveGlobalClip(trackIndex, clip.id); }} className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-600/90 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] z-30 border border-white/10 scale-75">
                          <i className="fas fa-times"></i>
                        </button>

                        <div onMouseDown={(e) => handleMouseDown(e, clip.id, 'extra', 'resize-right', clip.duration, clip.startTime, trackIndex)} className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/10 cursor-ew-resize z-20"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Timeline;

