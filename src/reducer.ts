import { TimerAction, TimerState, Preset } from './types';

export const PRESETS: Preset[] = [
  { id: 'classic', name: 'Classic', workMinutes: 25, breakMinutes: 5 },
  { id: 'deep', name: 'Deep Work', workMinutes: 50, breakMinutes: 10 },
  { id: '5217', name: '52/17 Method', workMinutes: 52, breakMinutes: 17 },
];

export const initialState: TimerState = {
  mode: 'work',
  timeLeft: PRESETS[0].workMinutes * 60,
  isActive: false,
  currentTask: '',
  selectedPresetId: 'classic',
  history: [],
  isBrainDumpOpen: false,
  brainDumpText: '',
  showReflection: false,
  lastSessionId: null,
};

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START':
      return { ...state, isActive: true };
    case 'PAUSE':
      return { ...state, isActive: false };
    case 'TICK':
      if (!state.isActive) return state;
      const newTime = Math.max(0, state.timeLeft - action.delta);
      if (newTime === 0) {
        return {
          ...state,
          isActive: false,
          showReflection: state.mode === 'work',
          timeLeft: 0,
          lastSessionId: crypto.randomUUID(),
        };
      }
      return { ...state, timeLeft: newTime };
    case 'RESET':
      const preset = PRESETS.find(p => p.id === state.selectedPresetId) || PRESETS[0];
      return {
        ...state,
        isActive: false,
        timeLeft: (state.mode === 'work' ? preset.workMinutes : preset.breakMinutes) * 60,
      };
    case 'SKIP':
      const nextMode = state.mode === 'work' ? 'break' : 'work';
      const nextPreset = PRESETS.find(p => p.id === state.selectedPresetId) || PRESETS[0];
      return {
        ...state,
        mode: nextMode,
        isActive: false,
        timeLeft: (nextMode === 'work' ? nextPreset.workMinutes : nextPreset.breakMinutes) * 60,
      };
    case 'SET_TASK':
      return { ...state, currentTask: action.task };
    case 'SET_PRESET':
      return {
        ...state,
        selectedPresetId: action.presetId,
        timeLeft: (state.mode === 'work' ? action.workMinutes : action.breakMinutes) * 60,
        isActive: false,
      };
    case 'TOGGLE_BRAIN_DUMP':
      return { ...state, isBrainDumpOpen: !state.isBrainDumpOpen };
    case 'SET_BRAIN_DUMP':
      return { ...state, brainDumpText: action.text };
    case 'COMPLETE_SESSION':
      const completedPreset = PRESETS.find(p => p.id === state.selectedPresetId) || PRESETS[0];
      const newHistoryItem = {
        id: state.lastSessionId || crypto.randomUUID(),
        task: state.currentTask,
        type: state.mode,
        duration: (state.mode === 'work' ? completedPreset.workMinutes : completedPreset.breakMinutes) * 60,
        focusRating: action.rating,
        timestamp: Date.now(),
      };
      const nextModeAfterComplete = state.mode === 'work' ? 'break' : 'work';
      return {
        ...state,
        history: [newHistoryItem, ...state.history],
        showReflection: false,
        mode: nextModeAfterComplete,
        timeLeft: (nextModeAfterComplete === 'work' ? completedPreset.workMinutes : completedPreset.breakMinutes) * 60,
      };
    case 'RESUME':
      return { ...state, ...action.state };
    default:
      return state;
  }
}
