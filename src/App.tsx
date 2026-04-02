import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Brain, 
  Music, 
  Volume2, 
  VolumeX,
  History as HistoryIcon,
  X,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { timerReducer, initialState, PRESETS } from './reducer';
import { TimerMode, SessionHistory } from './types';

// Ambient Sound URLs (Publicly available placeholders)
const AMBIENT_SOUNDS = [
  { id: 'white-noise', name: 'White Noise', url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' }, // Placeholder
  { id: 'rain', name: 'Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg' },
  { id: 'cafe', name: 'Cafe', url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  { id: 'lofi', name: 'Lo-Fi', url: 'https://actions.google.com/sounds/v1/science_fiction/low_hum.ogg' }, // Placeholder
];

export default function App() {
  const [state, dispatch] = useReducer(timerReducer, initialState, (initial) => {
    const saved = localStorage.getItem('pomo_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initial, history: parsed.history || [], selectedPresetId: parsed.selectedPresetId || 'classic' };
      } catch (e) {
        return initial;
      }
    }
    return initial;
  });

  const [volume, setVolume] = useState<Record<string, number>>({
    'white-noise': 0,
    'rain': 0,
    'cafe': 0,
    'lofi': 0,
  });

  const [activeSounds, setActiveSounds] = useState<Record<string, boolean>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const lastTickRef = useRef<number>(Date.now());
  const [isResumeOffered, setIsResumeOffered] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('pomo_state', JSON.stringify({
      history: state.history,
      selectedPresetId: state.selectedPresetId,
    }));
  }, [state.history, state.selectedPresetId]);

  // Session Storage for Refresh Handling
  useEffect(() => {
    if (state.isActive) {
      sessionStorage.setItem('pomo_active_session', JSON.stringify({
        mode: state.mode,
        timeLeft: state.timeLeft,
        currentTask: state.currentTask,
        selectedPresetId: state.selectedPresetId,
        timestamp: Date.now()
      }));
    } else {
      sessionStorage.removeItem('pomo_active_session');
    }
  }, [state.isActive, state.timeLeft, state.mode, state.currentTask, state.selectedPresetId]);

  // Check for resume on mount
  useEffect(() => {
    const savedSession = sessionStorage.getItem('pomo_active_session');
    if (savedSession) {
      setIsResumeOffered(true);
    }
  }, []);

  const handleResume = () => {
    const savedSession = sessionStorage.getItem('pomo_active_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      const elapsed = Math.floor((Date.now() - parsed.timestamp) / 1000);
      dispatch({ 
        type: 'RESUME', 
        state: { 
          ...parsed, 
          timeLeft: Math.max(0, parsed.timeLeft - elapsed),
          isActive: true 
        } 
      });
    }
    setIsResumeOffered(false);
  };

  // Timer Engine
  useEffect(() => {
    let interval: number;
    if (state.isActive) {
      lastTickRef.current = Date.now();
      interval = window.setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        dispatch({ type: 'TICK', delta });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [state.isActive]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.isActive) dispatch({ type: 'PAUSE' });
        else if (state.currentTask) dispatch({ type: 'START' });
      } else if (e.key === 'r' || e.key === 'R') {
        dispatch({ type: 'RESET' });
      } else if (e.key === 's' || e.key === 'S') {
        dispatch({ type: 'SKIP' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isActive, state.currentTask]);

  // Audio Logic
  const toggleSound = (id: string) => {
    setActiveSounds(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      if (newState[id]) {
        audioRefs.current[id]?.play();
      } else {
        audioRefs.current[id]?.pause();
      }
      return newState;
    });
  };

  const updateVolume = (id: string, val: number) => {
    setVolume(prev => ({ ...prev, [id]: val }));
    if (audioRefs.current[id]) {
      audioRefs.current[id].volume = val;
    }
  };

  // SVG Progress Ring
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const preset = PRESETS.find(p => p.id === state.selectedPresetId) || PRESETS[0];
  const totalSeconds = (state.mode === 'work' ? preset.workMinutes : preset.breakMinutes) * 60;
  const progress = state.timeLeft / totalSeconds;
  const offset = circumference * (1 - progress);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Drag to adjust scrubber logic
  const [isDragging, setIsDragging] = useState(false);
  const scrubberRef = useRef<SVGSVGElement>(null);

  const handleScrubberMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || state.isActive || !scrubberRef.current) return;
    
    const rect = scrubberRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const angle = Math.atan2(clientY - centerY, clientX - centerX);
    let normalizedAngle = angle + Math.PI / 2;
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    
    const newProgress = normalizedAngle / (2 * Math.PI);
    const newTime = Math.round(newProgress * 60 * 60); // Max 60 mins for scrubber
    dispatch({ type: 'RESUME', state: { timeLeft: newTime } });
  }, [isDragging, state.isActive]);

  // Gemini Task Refiner
  const [isRefining, setIsRefining] = useState(false);
  const refineTask = async () => {
    if (!state.currentTask) return;
    setIsRefining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Refine this Pomodoro task to be more actionable and focused: "${state.currentTask}". Keep it under 10 words.`,
      });
      if (response.text) {
        dispatch({ type: 'SET_TASK', task: response.text.trim() });
      }
    } catch (error) {
      console.error("Gemini error:", error);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-amber/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-sage/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl z-10"
      >
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-amber rounded-xl flex items-center justify-center shadow-lg shadow-accent-amber/20">
              <Play className="text-bg-slate fill-current" size={20} />
            </div>
            <h1 className="font-display text-2xl tracking-tight">FocusFlow</h1>
          </div>
          
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => dispatch({ type: 'SET_PRESET', presetId: p.id, workMinutes: p.workMinutes, breakMinutes: p.breakMinutes })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  state.selectedPresetId === p.id 
                    ? 'bg-white text-bg-slate shadow-lg' 
                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </header>

        {/* Main Timer Card */}
        <main className={`glass rounded-[40px] p-8 md:p-12 relative overflow-hidden transition-all duration-500 ${state.isActive ? 'animate-pulse-timer' : ''}`}>
          {/* Mode Indicator */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${state.mode === 'work' ? 'bg-accent-amber' : 'bg-accent-sage'}`} />
            <span className="text-xs font-mono uppercase tracking-widest text-white/60">
              {state.mode === 'work' ? 'Deep Work Session' : 'Rest & Recharge'}
            </span>
          </div>

          {/* Timer Circle */}
          <div className="flex flex-col items-center justify-center mt-8">
            <div className="relative group">
              <svg 
                ref={scrubberRef}
                width="300" 
                height="300" 
                className="transform -rotate-90 cursor-pointer select-none"
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={handleScrubberMove}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onTouchMove={handleScrubberMove}
              >
                {/* Background Track */}
                <circle
                  cx="150"
                  cy="150"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/5"
                />
                {/* Progress Ring */}
                <motion.circle
                  cx="150"
                  cy="150"
                  r={radius}
                  fill="transparent"
                  stroke={state.mode === 'work' ? '#F5A623' : '#7FB5A0'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ type: 'tween', ease: 'linear' }}
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_8px_rgba(245,166,35,0.3)]"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono text-6xl font-medium tracking-tighter">
                  {formatTime(state.timeLeft)}
                </span>
                <AnimatePresence mode="wait">
                  {!state.isActive && state.mode === 'work' && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs text-white/40 mt-2 font-medium tracking-widest uppercase"
                    >
                      Drag to adjust
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Task Input */}
            <div className="w-full max-w-sm mt-12 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="What are you focusing on?"
                  value={state.currentTask}
                  onChange={(e) => dispatch({ type: 'SET_TASK', task: e.target.value })}
                  disabled={state.isActive}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-accent-amber/50 transition-all placeholder:text-white/20 text-center text-lg"
                />
                <button 
                  onClick={refineTask}
                  disabled={!state.currentTask || isRefining || state.isActive}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-accent-amber transition-colors disabled:opacity-0"
                  title="Refine with AI"
                >
                  <Sparkles size={18} className={isRefining ? 'animate-pulse' : ''} />
                </button>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 transition-all"
                  title="Reset (R)"
                >
                  <RotateCcw size={24} />
                </button>
                
                <button
                  onClick={() => dispatch({ type: state.isActive ? 'PAUSE' : 'START' })}
                  disabled={!state.currentTask}
                  className={`flex-1 py-4 rounded-2xl font-display text-xl flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                    state.isActive 
                      ? 'bg-white text-bg-slate' 
                      : 'bg-accent-amber text-bg-slate shadow-accent-amber/20'
                  }`}
                >
                  {state.isActive ? (
                    <><Pause size={24} fill="currentColor" /> Pause</>
                  ) : (
                    <><Play size={24} fill="currentColor" /> Start Session</>
                  )}
                </button>

                <button
                  onClick={() => dispatch({ type: 'SKIP' })}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 transition-all"
                  title="Skip (S)"
                >
                  <SkipForward size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Habit Stacking Reminder */}
          <AnimatePresence>
            {!state.isActive && state.mode === 'work' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-8 flex items-center justify-center gap-2 text-white/40 text-sm italic"
              >
                <MessageSquare size={14} />
                <span>Session Anchor: Make tea, silence phone</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {/* Ambient Mixer */}
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4 text-white/80">
              <Music size={18} />
              <h3 className="font-medium">Ambient Sound</h3>
            </div>
            <div className="space-y-4">
              {AMBIENT_SOUNDS.map(sound => (
                <div key={sound.id} className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleSound(sound.id)}
                    className={`p-2 rounded-lg transition-all ${activeSounds[sound.id] ? 'bg-accent-amber text-bg-slate' : 'bg-white/5 text-white/40'}`}
                  >
                    {activeSounds[sound.id] ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 mb-1">
                      <span>{sound.name}</span>
                      <span>{Math.round(volume[sound.id] * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume[sound.id]}
                      onChange={(e) => updateVolume(sound.id, parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-amber"
                    />
                  </div>
                  <audio 
                    ref={el => { if (el) audioRefs.current[sound.id] = el; }} 
                    src={sound.url} 
                    loop 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Brain Dump & History */}
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => dispatch({ type: 'TOGGLE_BRAIN_DUMP' })}
              className="glass rounded-3xl p-6 flex items-center justify-between hover:bg-white/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-accent-amber/20 group-hover:text-accent-amber transition-all">
                  <Brain size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Brain Dump</h3>
                  <p className="text-xs text-white/40">Clear your mind mid-session</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                {state.isBrainDumpOpen ? <X size={16} /> : <Play size={16} className="rotate-90" />}
              </div>
            </button>

            <div className="glass rounded-3xl p-6 flex-1 max-h-[200px] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-4 text-white/80">
                <HistoryIcon size={18} />
                <h3 className="font-medium">Recent History</h3>
              </div>
              <div className="space-y-3">
                {state.history.length === 0 ? (
                  <p className="text-xs text-white/20 italic text-center py-4">No sessions completed yet</p>
                ) : (
                  state.history.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[150px]">{item.task}</span>
                        <span className="text-[10px] text-white/40 uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-1 h-3 rounded-full ${i < item.focusRating ? 'bg-accent-amber' : 'bg-white/10'}`} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Brain Dump Overlay */}
      <AnimatePresence>
        {state.isBrainDumpOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-slate/80 backdrop-blur-sm"
          >
            <div className="glass w-full max-w-lg rounded-[32px] p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Brain className="text-accent-amber" />
                  <h2 className="text-2xl font-display">Brain Dump</h2>
                </div>
                <button onClick={() => dispatch({ type: 'TOGGLE_BRAIN_DUMP' })} className="p-2 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-white/40 mb-4">Get it out of your head and back to the task. We'll save this for later.</p>
              <textarea
                autoFocus
                value={state.brainDumpText}
                onChange={(e) => dispatch({ type: 'SET_BRAIN_DUMP', text: e.target.value })}
                placeholder="What's distracting you?"
                className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 outline-none focus:border-accent-amber/50 transition-all resize-none text-lg"
              />
              <button 
                onClick={() => dispatch({ type: 'TOGGLE_BRAIN_DUMP' })}
                className="w-full mt-6 py-4 bg-white text-bg-slate rounded-2xl font-medium hover:bg-accent-amber transition-all"
              >
                Return to Focus
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reflection Modal */}
      <AnimatePresence>
        {state.showReflection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-slate/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ y: 20, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              className="glass max-w-md w-full rounded-[40px] p-10 text-center"
            >
              <div className="w-20 h-20 bg-accent-amber/20 text-accent-amber rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Sparkles size={40} />
              </div>
              <h2 className="text-3xl font-display mb-2">Session Complete</h2>
              <p className="text-white/60 mb-8">How was your focus during this session?</p>
              
              <div className="flex justify-center gap-3 mb-10">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => dispatch({ type: 'COMPLETE_SESSION', rating })}
                    className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-accent-amber hover:text-bg-slate transition-all flex items-center justify-center text-xl font-bold border border-white/10"
                  >
                    {rating}
                  </button>
                ))}
              </div>
              
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/20">
                1: Distracted — 5: Flow State
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Toast */}
      <AnimatePresence>
        {isResumeOffered && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] glass px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl border-accent-amber/30"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">Interrupted session found</span>
              <span className="text-xs text-white/40">Would you like to resume?</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsResumeOffered(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
              >
                Dismiss
              </button>
              <button 
                onClick={handleResume}
                className="px-4 py-2 rounded-xl bg-accent-amber text-bg-slate text-sm font-bold"
              >
                Resume
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
