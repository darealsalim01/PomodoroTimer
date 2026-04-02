export type TimerMode = 'work' | 'break';

export interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  breakMinutes: number;
}

export interface SessionHistory {
  id: string;
  task: string;
  type: TimerMode;
  duration: number; // in seconds
  focusRating: number;
  timestamp: number;
}

export interface TimerState {
  mode: TimerMode;
  timeLeft: number; // in seconds
  isActive: boolean;
  currentTask: string;
  selectedPresetId: string;
  history: SessionHistory[];
  isBrainDumpOpen: boolean;
  brainDumpText: string;
  showReflection: boolean;
  lastSessionId: string | null;
}

export type TimerAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'TICK'; delta: number }
  | { type: 'RESET' }
  | { type: 'SKIP' }
  | { type: 'SET_TASK'; task: string }
  | { type: 'SET_PRESET'; presetId: string; workMinutes: number; breakMinutes: number }
  | { type: 'TOGGLE_BRAIN_DUMP' }
  | { type: 'SET_BRAIN_DUMP'; text: string }
  | { type: 'COMPLETE_SESSION'; rating: number }
  | { type: 'RESUME'; state: Partial<TimerState> };
