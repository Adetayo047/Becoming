import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';
import { router } from 'expo-router';

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
  options: RequestInit = {},
  skipJsonContentType = false
): Promise<{ data: T | null; error: string | null; upgrade?: boolean }> {
  const token = await getToken();

  const headers: Record<string, string> = {
    ...(!skipJsonContentType && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const json = await res.json();

    // 402 = the feature needs a higher plan. Prompt once here so every screen
    // gets the same "See Plans" path; callers can check `upgrade` to skip
    // showing their own error on top.
    if (res.status === 402) {
      promptUpgrade(json.error, json.upgradeTier === 'plus' ? 'plus' : 'pro');
      return { data: null, error: json.error ?? 'Upgrade required', upgrade: true };
    }

    if (!res.ok) {
      return { data: null, error: json.error ?? 'Something went wrong' };
    }

    return { data: json.data as T, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message ?? 'Network error' };
  }
}

export function promptUpgrade(message: string, tier: 'pro' | 'plus' = 'pro') {
  Alert.alert(`Upgrade to ${tier === 'plus' ? 'Plus' : 'Pro'} ✨`, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'See Plans', onPress: () => router.push('/billing') },
  ]);
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

function del<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'DELETE', ...(body !== undefined && { body: JSON.stringify(body) }) });
}

// FormData body — fetch sets its own multipart boundary header, so the
// forced application/json Content-Type above must be skipped here.
function postForm<T>(path: string, body: FormData) {
  return request<T>(path, { method: 'POST', body: body as unknown as BodyInit }, true);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: ApiUser;
  /** True when this sign-in brought a deactivated account back. */
  reactivated?: boolean;
}

export type AiPersonality = 'encouraging' | 'stoic' | 'visionary' | 'direct' | 'analytical';
export type ProgressVisibility = 'only_me' | 'trusted' | 'community';

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  tier: 'free' | 'pro' | 'plus';
  onboardingComplete: boolean;
  avatarUrl?: string;
  notificationsEnabled: boolean;
  nudgeFrequency: 'sparse' | 'balanced' | 'high_intensity';
  stoicMode: boolean;
  googleCalendarConnected: boolean;
  emailVerified: boolean;
  aiPersonality: AiPersonality;
  focusHoursStart?: string | null;
  focusHoursEnd?: string | null;
  progressVisibility: ProgressVisibility;
  wakeUpCallEnabled: boolean;
  wakeUpCallTime?: string | null;
  utcOffsetMinutes?: number | null;
  createdAt: string;
}

export interface SignUpResponse extends AuthResponse {
  emailSent: boolean;
  devVerificationCode?: string;
}

export const auth = {
  signUp: (email: string, password: string, fullName: string, termsAccepted: boolean) =>
    post<SignUpResponse>('/api/auth/signup', { email, password, fullName, termsAccepted }),

  signIn: (email: string, password: string) =>
    post<AuthResponse>('/api/auth/signin', { email, password }),

  me: () => get<ApiUser>('/api/auth/me'),

  updateMe: (
    data: Partial<
      Pick<
        ApiUser,
        | 'fullName'
        | 'onboardingComplete'
        | 'notificationsEnabled'
        | 'nudgeFrequency'
        | 'stoicMode'
        | 'aiPersonality'
        | 'focusHoursStart'
        | 'focusHoursEnd'
        | 'progressVisibility'
        | 'wakeUpCallEnabled'
        | 'wakeUpCallTime'
        | 'utcOffsetMinutes'
      >
    > & { pushToken?: string }
  ) => patch<ApiUser>('/api/auth/me', data),

  /** Permanently deletes the account and all its data. */
  deleteAccount: (password: string) => del<{ deleted: boolean }>('/api/auth/me', { password }),

  /** Keeps the data, pauses nudges and wake-up calls; signing in reactivates. */
  deactivate: () => post<{ deactivated: boolean }>('/api/auth/deactivate', {}),

  changePassword: (currentPassword: string, newPassword: string) =>
    patch<{ updated: boolean }>('/api/auth/password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    post<{ sent: boolean }>('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    post<{ reset: boolean }>('/api/auth/reset-password', { token, newPassword }),

  verifyEmail: (code: string) =>
    post<{ emailVerified: boolean }>('/api/auth/verify-email', { code }),

  resendVerification: () =>
    post<{ emailSent: boolean; devVerificationCode?: string }>('/api/auth/resend-verification', {}),
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
  yearlyTargets?: ApiYearlyTarget[];
  monthlyTargets?: ApiMonthlyTarget[];
  weeklyFocuses?: ApiWeeklyFocus[];
  createdAt: string;
}

export interface ApiMilestone {
  id: string;
  goalId: string;
  title: string;
  status: 'pending' | 'completed';
  timeInvestedMinutes?: number;
  reflection?: string | null;
}

export interface ApiMilestoneSubtask {
  id: string;
  milestoneId: string;
  title: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

export interface ApiMilestoneResource {
  id: string;
  milestoneId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface ApiMilestoneDetail extends ApiMilestone {
  targetDate?: string | null;
  timeInvestedMinutes: number;
  reflection: string | null;
  reflectionUpdatedAt: string | null;
  goal: { id: string; title: string; category: string };
  subtasks: ApiMilestoneSubtask[];
  resources: ApiMilestoneResource[];
  subtaskCompletionPercent: number | null;
  upNext: { id: string; title: string } | null;
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

export interface ApiGoalDetail extends ApiGoal {
  dailyTasks: ApiTask[];
}

export const goals = {
  list: (status?: string) =>
    get<ApiGoal[]>(`/api/goals${status ? `?status=${status}` : ''}`),

  get: (id: string) => get<ApiGoalDetail>(`/api/goals/${id}`),

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

  addMilestones: (id: string, titles: string[]) =>
    post<ApiMilestone[]>(`/api/goals/${id}/milestones`, { titles }),
};

export const milestones = {
  get: (id: string) => get<ApiMilestoneDetail>(`/api/milestones/${id}`),

  update: (id: string, data: { completed?: boolean; title?: string; reflection?: string; logMinutes?: number }) =>
    patch<ApiMilestone>(`/api/milestones/${id}`, data),

  subtasks: {
    create: (milestoneId: string, title: string) =>
      post<ApiMilestoneSubtask>(`/api/milestones/${milestoneId}/subtasks`, { title }),

    update: (milestoneId: string, subtaskId: string, data: { completed?: boolean; title?: string; order?: number }) =>
      patch<ApiMilestoneSubtask>(`/api/milestones/${milestoneId}/subtasks/${subtaskId}`, data),

    delete: (milestoneId: string, subtaskId: string) =>
      del<{ deleted: boolean }>(`/api/milestones/${milestoneId}/subtasks/${subtaskId}`),
  },

  resources: {
    create: (milestoneId: string, title: string, url: string) =>
      post<ApiMilestoneResource>(`/api/milestones/${milestoneId}/resources`, { title, url }),

    delete: (milestoneId: string, resourceId: string) =>
      del<{ deleted: boolean }>(`/api/milestones/${milestoneId}/resources/${resourceId}`),
  },
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type BlockType = 'deep_work' | 'review' | 'break' | 'sync' | 'custom';

export interface ApiTask {
  id: string;
  userId: string;
  goalId?: string;
  goal?: { title: string; category: string } | null;
  title: string;
  date: string;
  completed: boolean;
  completedAt?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  blockType?: string | null;
  aiGenerated?: boolean;
  order?: number;
  createdAt: string;
}

export const tasks = {
  list: (date?: string) =>
    get<ApiTask[]>(`/api/tasks${date ? `?date=${date}` : ''}`),

  create: (data: { title: string; goalId?: string; date?: string }) =>
    post<ApiTask>('/api/tasks', data),

  update: (
    id: string,
    data: {
      completed?: boolean;
      title?: string;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      blockType?: string;
      order?: number;
      goalId?: string | null;
    }
  ) => patch<ApiTask>(`/api/tasks/${id}`, data),

  delete: (id: string) => del<{ deleted: boolean }>(`/api/tasks/${id}`),
};

// ─── Planner ─────────────────────────────────────────────────────────────────

export interface ApiYearlyTarget {
  id: string;
  goalId: string;
  year: number;
  title: string;
  status: 'pending' | 'completed';
}

export interface ApiPlannerGoal {
  id: string;
  title: string;
  category: string;
  completionPercent: number;
  yearlyTargets: ApiYearlyTarget[];
  monthlyTargets: ApiMonthlyTarget[];
  weeklyFocuses: ApiWeeklyFocus[];
  weekTaskCount: number;
  weekTasksDone: number;
}

export interface ApiPlannerGap {
  type: 'no_yearly' | 'no_monthly' | 'no_weekly' | 'no_tasks_week' | 'unlinked_task';
  goalId?: string;
  taskId?: string;
  message: string;
}

export interface ApiPlanner {
  year: number;
  month: string;
  weekStart: string;
  today: string;
  goals: ApiPlannerGoal[];
  todayTasks: ApiTask[];
  alignment: { score: number; message: string };
  gaps: ApiPlannerGap[];
}

export interface ApiYearPlanGoal {
  id: string;
  title: string;
  category: string;
  yearlyTargets: ApiYearlyTarget[];
  monthlyTargets: ApiMonthlyTarget[];
  weeklyFocuses: ApiWeeklyFocus[];
}

export interface ApiYearPlan {
  year: number;
  goals: ApiYearPlanGoal[];
  taskDays: Record<string, { total: number; done: number }>;
}

export type PlanKind = 'yearly' | 'monthly' | 'weekly';

export const planner = {
  /** The cascade for one day ("YYYY-MM-DD"), default today. */
  get: (date?: string) => get<ApiPlanner>(`/api/planner${date ? `?date=${date}` : ''}`),

  year: (year: number) => get<ApiYearPlan>(`/api/planner/year?year=${year}`),

  /** period: "YYYY" for yearly, "YYYY-MM" for monthly, any "YYYY-MM-DD" in the week for weekly. */
  addTarget: (kind: PlanKind, goalId: string, title: string, period?: string) =>
    post<ApiYearlyTarget | ApiMonthlyTarget | ApiWeeklyFocus>('/api/planner/targets', { kind, goalId, title, period }),

  updateTarget: (kind: PlanKind, id: string, data: { status?: 'pending' | 'completed'; title?: string }) =>
    patch<ApiYearlyTarget | ApiMonthlyTarget | ApiWeeklyFocus>(`/api/planner/targets/${id}`, { kind, ...data }),

  deleteTarget: (kind: PlanKind, id: string) =>
    del<{ deleted: boolean }>(`/api/planner/targets/${id}?kind=${kind}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardTrend {
  weekly: Array<{ weekStart: string; completed: number; total: number; rate: number }>;
  thisWeek: Array<{ date: string; count: number }>;
  thisWeekCompleted: number;
  lastWeekSameDays: number;
  changePercent: number | null;
  peakDay: string | null;
}

export interface DashboardData {
  trend: DashboardTrend | null; // null on the Free plan
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

// ─── Calendar ──────────────────────────────────────────────────────────────

export const calendar = {
  // Not a fetch — the token has to travel in the URL because this is opened
  // as a real browser navigation (expo-web-browser), which can't set headers.
  connectUrl: async () => `${BASE_URL}/api/calendar/connect?token=${await getToken()}`,

  disconnect: () => post<{ disconnected: boolean }>('/api/calendar/disconnect', {}),

  syncTask: (taskId: string) => post<{ synced: boolean }>('/api/calendar/sync-task', { taskId }),
};

// ─── Notifications ─────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  category: 'ai_architect' | 'accountability' | 'system';
  title: string;
  body: string;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
}

export const notifications = {
  sendTest: () => post<{ sent: boolean }>('/api/notifications/test', {}),

  list: (category?: string) =>
    get<ApiNotification[]>(`/api/notifications${category ? `?category=${category}` : ''}`),

  markRead: (id: string) => patch<ApiNotification>('/api/notifications', { id }),

  clearAll: () => patch<{ cleared: boolean }>('/api/notifications', { clearAll: true }),
};

// ─── Accountability ────────────────────────────────────────────────────────

export interface ApiPartnership {
  id: string;
  status: 'pending' | 'active';
  iInvited: boolean;
  partner: { id: string; fullName: string; email: string };
  activeGoals: number;
  tasksCompletedRecently: number;
  createdAt: string;
}

export interface ApiPartnerMessage {
  id: string;
  kind: 'note' | 'poke';
  body: string;
  liked: boolean;
  createdAt: string;
  mine: boolean;
  sender: { id: string; fullName: string };
}

export interface ApiPartnerDetail {
  id: string;
  status: 'pending' | 'active';
  partner: { id: string; fullName: string; email: string; avatarUrl?: string | null };
  activeGoals: number;
  syncRate: number | null;
  syncChange: number | null;
  tasksCompletedThisWeek: number;
  currentStreak: number;
  messages: ApiPartnerMessage[];
}

export const accountability = {
  list: () => get<ApiPartnership[]>('/api/accountability'),

  get: (id: string) => get<ApiPartnerDetail>(`/api/accountability/${id}`),

  sendMessage: (id: string, body: string) =>
    post<ApiPartnerMessage>(`/api/accountability/${id}/messages`, { body }),

  likeMessage: (id: string, messageId: string, liked: boolean) =>
    patch<ApiPartnerMessage>(`/api/accountability/${id}/messages/${messageId}`, { liked }),

  invite: (partnerEmail: string) =>
    post<ApiPartnership>('/api/accountability', { partnerEmail }),

  accept: (id: string) => patch<ApiPartnership>(`/api/accountability/${id}`, {}),

  remove: (id: string) => del<{ deleted: boolean }>(`/api/accountability/${id}`),

  poke: (id: string, message?: string) =>
    post<{ poked: boolean }>(`/api/accountability/${id}/poke`, { message }),
};

// ─── Community ─────────────────────────────────────────────────────────────

export type PostKind = 'milestone' | 'achievement' | 'small_win';
export type ReactionType = 'celebration' | 'favorite' | 'fire' | 'thumbs_up';

interface CommunityUser {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface ApiCommunityPost {
  id: string;
  kind: PostKind;
  headline: string;
  body?: string | null;
  createdAt: string;
  user: CommunityUser;
  goal?: { id: string; title: string; category: string } | null;
  reactionCounts: Partial<Record<ReactionType, number>>;
  myReaction: ReactionType | null;
  commentCount: number;
}

export interface ApiCommunityComment {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  user: CommunityUser;
}

export interface ApiCommunityPostDetail extends Omit<ApiCommunityPost, 'commentCount'> {
  comments: ApiCommunityComment[];
}

export interface ApiSuggestedPartner {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  matchScore: number;
  growthAreas: string[];
  activeGoalCount: number;
}

export interface ApiCommunityGroup {
  id: string;
  name: string;
  createdAt: string;
  members: CommunityUser[];
  messageCount?: number;
  groupGoalProgress?: { membersDone: number; totalMembers: number; percent: number };
}

export interface ApiGroupMessage {
  id: string;
  groupId: string;
  body: string;
  createdAt: string;
  user: CommunityUser;
}

export const community = {
  feed: () => get<ApiCommunityPost[]>('/api/community/posts'),

  createPost: (data: { kind: PostKind; headline: string; body?: string; goalId?: string }) =>
    post<ApiCommunityPost>('/api/community/posts', data),

  getPost: (id: string) => get<ApiCommunityPostDetail>(`/api/community/posts/${id}`),

  updatePost: (id: string, data: { headline?: string; body?: string; kind?: PostKind }) =>
    patch<ApiCommunityPost>(`/api/community/posts/${id}`, data),

  deletePost: (id: string) => del<{ deleted: boolean }>(`/api/community/posts/${id}`),

  react: (postId: string, type: ReactionType) =>
    post<{ reaction: ReactionType | null }>(`/api/community/posts/${postId}/react`, { type }),

  comments: (postId: string) => get<ApiCommunityComment[]>(`/api/community/posts/${postId}/comments`),

  addComment: (postId: string, body: string) =>
    post<ApiCommunityComment>(`/api/community/posts/${postId}/comments`, { body }),

  discover: () => get<ApiSuggestedPartner[]>('/api/community/discover'),

  groups: {
    list: () => get<ApiCommunityGroup[]>('/api/community/groups'),

    create: (name: string, memberEmails: string[]) =>
      post<ApiCommunityGroup & { skippedEmails?: string[] }>('/api/community/groups', { name, memberEmails }),

    get: (id: string) => get<ApiCommunityGroup>(`/api/community/groups/${id}`),

    messages: (id: string, since?: string) =>
      get<ApiGroupMessage[]>(`/api/community/groups/${id}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`),

    sendMessage: (id: string, body: string) =>
      post<ApiGroupMessage>(`/api/community/groups/${id}/messages`, { body }),
  },
};

// ─── Weekly Review ─────────────────────────────────────────────────────────

export interface ApiWeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  completedCount: number;
  blockedText?: string | null;
  carryForwardText?: string | null;
  rating?: number | null;
  aiInsight?: string | null;
  createdAt: string;
}

export interface ApiWeekData {
  weekStart: string;
  review: ApiWeeklyReview | null;
  wins: ApiCommunityPost[];
  completedCount: number;
}

/** How well a week matched the plan — returned when a weekly review is saved. */
export interface WeekAlignment {
  score: number;
  tasksDone: number;
  tasksTotal: number;
  tasksLinked: number;
  goals: number;
  fullyPlanned: number;
  weeklyDone: number;
  weeklyTotal: number;
  streakWeeks: number;
}

export const weeklyReview = {
  get: (weekStart?: string) =>
    get<ApiWeekData>(`/api/weekly-review${weekStart ? `?weekStart=${weekStart}` : ''}`),

  save: (data: { weekStart: string; blockedText?: string; carryForwardText?: string; rating?: number }) =>
    post<ApiWeeklyReview & { alignment: WeekAlignment }>('/api/weekly-review', data),

  generateInsight: (weekStart: string, blockedText?: string) =>
    post<{ insight: string | null; reason?: string }>('/api/weekly-review/insight', { weekStart, blockedText }),
};

// ─── Growth Passport ───────────────────────────────────────────────────────

export interface ApiBadge {
  key: string;
  label: string;
  emoji: string;
  description: string;
  earnedAt: string;
}

export interface ApiProfileStats {
  fullName?: string;
  avatarUrl?: string | null;
  memberSince: string;
  totalMilestones: number;
  milestonesThisMonth: number;
  currentStreak: number;
  longestStreak: number;
  alignmentScore: number;
  level: number;
  badges: ApiBadge[];
}

export interface ApiHistoryPoint {
  month: string;
  milestonesCompleted: number;
  consistencyPercent: number;
}

export const profileStats = {
  get: () => get<ApiProfileStats>('/api/profile/stats'),

  history: (months = 6) => get<{ history: ApiHistoryPoint[] }>(`/api/profile/stats/history?months=${months}`),
};

// ─── Billing ───────────────────────────────────────────────────────────────

export interface ApiPlan {
  label: string;
  priceNaira: number;
  benefits: string[];
}

export interface ApiBillingInfo {
  currentTier: 'free' | 'pro' | 'plus';
  plans: Record<'free' | 'pro' | 'plus', ApiPlan>;
  paystackConfigured: boolean;
  demoPayments: boolean;
}

export const billing = {
  get: () => get<ApiBillingInfo>('/api/billing'),

  changePlan: (tier: 'free' | 'pro' | 'plus') =>
    post<{ id: string; tier: string }>('/api/billing/change-plan', { tier }),

  cancel: () => post<{ id: string; tier: string }>('/api/billing/cancel', {}),
};

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface ApiProposedMilestone {
  title: string;
  monthlyTarget?: string;
  weeklyFocus?: string;
  firstTask?: string;
}

export interface ApiPlanBlock {
  taskId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  type: BlockType | string;
  reasoning?: string;
}

export interface ApiDayPlan {
  date: string;
  summary: string;
  strategicScore: number | null;
  blocks: ApiPlanBlock[];
}

export const ai = {
  suggestMilestones: (goalTitle: string, goalCategory?: string) =>
    post<{ milestones: string[] }>('/api/ai/suggest-milestones', { goalTitle, goalCategory }),

  suggestDailyTask: (goalTitle: string, weeklyFocus?: string) =>
    post<{ task: string }>('/api/ai/suggest-daily-task', { goalTitle, weeklyFocus }),

  /** One-line motivation written for the user's goal and today's progress; `date` is their local today. */
  motivation: (date: string) =>
    get<{ message: string; situation: string; source: 'ai' | 'fallback' }>(`/api/ai/motivation?date=${date}`),

  architect: (message: string, sessionId?: string) =>
    post<{ sessionId: string; reply: string; proposedMilestone: ApiProposedMilestone | null }>(
      '/api/ai/architect',
      { message, sessionId }
    ),

  planDay: (date?: string, note?: string) => post<ApiDayPlan>('/api/ai/plan-day', { date, note }),

  commitPlan: (date: string, blocks: ApiPlanBlock[]) =>
    post<{ committed: number; tasks: ApiTask[] }>('/api/ai/plan-day/commit', { date, blocks }),
};

// ─── Voice (Wake-Up Call) ────────────────────────────────────────────────────

export type VoiceCallStatus = 'scheduled' | 'ringing' | 'active' | 'completed' | 'declined' | 'missed' | 'failed';

export interface ApiVoiceCallSession {
  id: string;
  status: VoiceCallStatus;
  scheduledFor: string;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export interface ApiVoiceTurnResult {
  voiceCallSessionId: string;
  chatSessionId: string;
  transcript: string;
  tasks: string[];
  confirmation: string;
  replyAudioBase64: string;
  replyAudioFormat: 'mp3';
}

export interface ApiRealtimeSession {
  clientSecret: string;
  expiresAt: number;
  realtimeModel: string;
  voiceCallSessionId: string;
  chatSessionId: string;
}

export const voice = {
  // Turn-based loop — works in Expo Go today. `audioUri` is a local file
  // from expo-audio's recorder (recorder.uri).
  //
  // Expo SDK 57 installs its own `expo/fetch` as the global fetch, and its
  // multipart encoder only accepts strings, real Blobs, or objects exposing
  // a bytes() method — NOT React Native's classic {uri, name, type} pseudo-
  // file object, which throws "Unsupported FormDataPart implementation".
  // expo-file-system's `File` class implements Blob natively, so it's the
  // one shape that works here.
  sendTurn: (audioUri: string, voiceCallSessionId?: string, alreadyAdded: string[] = []) => {
    const form = new FormData();
    const file = new File(audioUri);
    form.append('audio', file, file.name || 'turn.m4a');
    if (voiceCallSessionId) form.append('voiceCallSessionId', voiceCallSessionId);
    form.append('alreadyAdded', JSON.stringify(alreadyAdded));
    return postForm<ApiVoiceTurnResult>('/api/voice/turn', form);
  },

  decline: () => post<ApiVoiceCallSession>('/api/voice-calls/decline', {}),

  finish: (id: string, status: 'completed' | 'missed' | 'failed') =>
    post<ApiVoiceCallSession>(`/api/voice-calls/${id}/finish`, { status }),

  history: () => get<ApiVoiceCallSession[]>('/api/voice-calls'),

  // Live duplex — needs a custom EAS dev-client build (react-native-webrtc
  // isn't available in Expo Go). Mints an ephemeral OpenAI Realtime token;
  // see api/app/api/realtime/session/route.ts for the connection protocol.
  realtimeSession: () => post<ApiRealtimeSession>('/api/realtime/session', {}),
};

// ─── Premium Insights (Plus) ─────────────────────────────────────────────────

export interface ApiInsights {
  windows: { start: number; count: number }[];
  peakStart: number | null;
  resilience: { score: number; label: string; bounceRate: number; completionRate: number; activeDays: number };
  stats: { totalTasks: number; doneTasks: number; activeDays: number; peakWindow: string | null };
  insights: { title: string; body: string }[];
}

export const insights = {
  /** `date` is the local today; tz is minutes east of UTC. */
  get: (date: string) =>
    get<ApiInsights>(`/api/insights?date=${date}&tz=${-new Date().getTimezoneOffset()}`),
};

// ─── Smart Reminders ─────────────────────────────────────────────────────────

export interface ApiReminders {
  insight: { title: string; body: string } | null;
  peakWindow: string | null;
  nudges: { taskId: string; title: string; time: string; goal: string | null; deepWork: boolean; line: string }[];
  unscheduled: number;
  stats: { routineIntegrity: number | null; streak: number };
}

export const reminders = {
  get: (date: string) =>
    get<ApiReminders>(`/api/ai/reminders?date=${date}&tz=${-new Date().getTimezoneOffset()}`),
};
