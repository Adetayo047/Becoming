import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your deployed API URL in production
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = '@becoming_token';

// ─── Token helpers ──────────────────────────────────────────────────────────

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── Core fetcher ────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const json = await res.json();

    if (!res.ok) {
      return { data: null, error: json.error ?? 'Something went wrong' };
    }

    return { data: json.data as T, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message ?? 'Network error' };
  }
}

function get<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  tier: 'free' | 'pro' | 'plus';
  onboardingComplete: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export const auth = {
  signUp: (email: string, password: string, fullName: string) =>
    post<AuthResponse>('/api/auth/signup', { email, password, fullName }),

  signIn: (email: string, password: string) =>
    post<AuthResponse>('/api/auth/signin', { email, password }),

  me: () => get<ApiUser>('/api/auth/me'),

  updateMe: (data: Partial<Pick<ApiUser, 'fullName' | 'onboardingComplete'>> & { pushToken?: string }) =>
    patch<ApiUser>('/api/auth/me', data),
};

// ─── Onboarding ──────────────────────────────────────────────────────────────

export const onboarding = {
  complete: (data: {
    goalTitle: string;
    goalCategory: string;
    milestones?: string[];
    monthlyTarget?: string;
    weeklyFocus?: string;
    firstTask?: string;
  }) => post<{ user: ApiUser; goal: ApiGoal }>('/api/onboarding', data),
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface ApiGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  status: 'active' | 'paused' | 'completed';
  completionPercent?: number;
  milestones?: ApiMilestone[];
  monthlyTargets?: ApiMonthlyTarget[];
  weeklyFocuses?: ApiWeeklyFocus[];
  createdAt: string;
}

export interface ApiMilestone {
  id: string;
  goalId: string;
  title: string;
  status: 'pending' | 'completed';
}

export interface ApiMonthlyTarget {
  id: string;
  goalId: string;
  month: string;
  title: string;
  status: 'pending' | 'completed';
}

export interface ApiWeeklyFocus {
  id: string;
  goalId: string;
  weekStart: string;
  title: string;
  status: 'pending' | 'completed';
}

export const goals = {
  list: (status?: string) =>
    get<ApiGoal[]>(`/api/goals${status ? `?status=${status}` : ''}`),

  get: (id: string) => get<ApiGoal>(`/api/goals/${id}`),

  create: (data: {
    title: string;
    description?: string;
    category: string;
    targetDate?: string;
    milestones?: string[];
    monthlyTarget?: string;
    weeklyFocus?: string;
    firstTask?: string;
  }) => post<ApiGoal>('/api/goals', data),

  update: (id: string, data: Partial<ApiGoal>) =>
    patch<ApiGoal>(`/api/goals/${id}`, data),

  delete: (id: string) => del<{ deleted: boolean }>(`/api/goals/${id}`),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface ApiTask {
  id: string;
  userId: string;
  goalId?: string;
  goal?: { title: string; category: string } | null;
  title: string;
  date: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export const tasks = {
  list: (date?: string) =>
    get<ApiTask[]>(`/api/tasks${date ? `?date=${date}` : ''}`),

  create: (data: { title: string; goalId?: string; date?: string }) =>
    post<ApiTask>('/api/tasks', data),

  update: (id: string, data: { completed?: boolean; title?: string }) =>
    patch<ApiTask>(`/api/tasks/${id}`, data),

  delete: (id: string) => del<{ deleted: boolean }>(`/api/tasks/${id}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardData {
  overallPercent: number;
  totalTasksCompleted: number;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    completionPercent: number;
  }>;
  heatmap: Array<{ date: string; count: number }>;
  streaks: Array<{
    id: string;
    taskTitle: string;
    currentStreak: number;
    longestStreak: number;
  }>;
}

export const dashboard = {
  get: () => get<DashboardData>('/api/dashboard'),
};
