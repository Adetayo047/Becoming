import { Category } from '../constants/theme';

export type Tier = 'free' | 'pro' | 'plus';
export type GoalStatus = 'active' | 'paused' | 'completed';
export type TaskStatus = 'pending' | 'completed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  tier: Tier;
  onboarding_complete: boolean;
  push_token?: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: Category;
  target_date?: string;
  status: GoalStatus;
  created_at: string;
  milestones?: Milestone[];
  monthly_targets?: MonthlyTarget[];
  weekly_focuses?: WeeklyFocus[];
  completion_percent?: number;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  target_date?: string;
  status: TaskStatus;
  created_at: string;
}

export interface MonthlyTarget {
  id: string;
  goal_id: string;
  month: string; // YYYY-MM
  title: string;
  status: TaskStatus;
  created_at: string;
}

export interface WeeklyFocus {
  id: string;
  goal_id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  title: string;
  status: TaskStatus;
  created_at: string;
}

export interface DailyTask {
  id: string;
  user_id: string;
  goal_id?: string;
  goal?: Pick<Goal, 'title' | 'category'>;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface HabitStreak {
  id: string;
  user_id: string;
  task_title: string;
  current_streak: number;
  longest_streak: number;
  last_completed?: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  completed_count: number;
  blocked_text?: string;
  carry_forward_text?: string;
  rating?: number;
  ai_insight?: string;
  created_at: string;
}

export interface AccountabilityPartner {
  id: string;
  user_id: string;
  partner_user_id: string;
  partner?: User;
  status: 'pending' | 'active';
  created_at: string;
}
