import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiUser, ApiGoal, ApiTask } from './api';

interface AuthState {
  user: ApiUser | null;
  token: string | null;
  loading: boolean;
  setUser: (user: ApiUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, token: null }),
}));

interface OnboardingState {
  selectedCategories: string[];
  firstGoalTitle: string;
  firstGoalCategory: string;
  setCategories: (cats: string[]) => void;
  setFirstGoal: (title: string, category: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  selectedCategories: [],
  firstGoalTitle: '',
  firstGoalCategory: 'career',
  setCategories: (cats) => set({ selectedCategories: cats }),
  setFirstGoal: (title, category) =>
    set({ firstGoalTitle: title, firstGoalCategory: category }),
  reset: () =>
    set({ selectedCategories: [], firstGoalTitle: '', firstGoalCategory: 'career' }),
}));

interface GoalState {
  goals: ApiGoal[];
  todayTasks: ApiTask[];
  setGoals: (goals: ApiGoal[]) => void;
  setTodayTasks: (tasks: ApiTask[]) => void;
  toggleTask: (taskId: string) => void;
  addTask: (task: ApiTask) => void;
  addGoal: (goal: ApiGoal) => void;
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  todayTasks: [],
  setGoals: (goals) => set({ goals }),
  setTodayTasks: (tasks) => set({ todayTasks: tasks }),
  toggleTask: (taskId) =>
    set((state) => ({
      todayTasks: state.todayTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? new Date().toISOString() : undefined,
            }
          : t
      ),
    })),
  addTask: (task) => set((state) => ({ todayTasks: [task, ...state.todayTasks] })),
  addGoal: (goal) => set((state) => ({ goals: [goal, ...state.goals] })),
}));

// Per-device UI preferences — not account data, so they live in AsyncStorage
// rather than the backend. A zustand store (not a bare AsyncStorage read) so
// every subscriber — the floating QuickTalkButton and its Settings toggle —
// reacts instantly to a change in the same session, not just after restart.
export const QUICK_TALK_PREF_KEY = '@becoming_quick_talk_enabled';

interface PrefsState {
  quickTalkEnabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setQuickTalkEnabled: (value: boolean) => void;
}

export const usePrefsStore = create<PrefsState>((set) => ({
  quickTalkEnabled: true,
  hydrated: false,
  hydrate: async () => {
    const v = await AsyncStorage.getItem(QUICK_TALK_PREF_KEY);
    set({ quickTalkEnabled: v !== 'false', hydrated: true });
  },
  setQuickTalkEnabled: (value) => {
    set({ quickTalkEnabled: value });
    AsyncStorage.setItem(QUICK_TALK_PREF_KEY, String(value));
  },
}));
