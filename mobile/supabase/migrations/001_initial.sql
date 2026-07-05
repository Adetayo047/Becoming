-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  tier text not null default 'free' check (tier in ('free', 'pro', 'plus')),
  onboarding_complete boolean not null default false,
  push_token text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
create policy "Users can read own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- GOALS
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  category text not null check (category in ('career', 'skills', 'health', 'money', 'relationships')),
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
create policy "Users manage own goals" on public.goals using (auth.uid() = user_id);

-- MILESTONES
create table public.milestones (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references public.goals(id) on delete cascade not null,
  title text not null,
  target_date date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;
create policy "Users manage own milestones" on public.milestones
  using (exists (select 1 from public.goals where id = goal_id and user_id = auth.uid()));

-- MONTHLY TARGETS
create table public.monthly_targets (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references public.goals(id) on delete cascade not null,
  month text not null, -- YYYY-MM
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.monthly_targets enable row level security;
create policy "Users manage own monthly targets" on public.monthly_targets
  using (exists (select 1 from public.goals where id = goal_id and user_id = auth.uid()));

-- WEEKLY FOCUSES
create table public.weekly_focuses (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references public.goals(id) on delete cascade not null,
  week_start date not null, -- Monday of that week
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.weekly_focuses enable row level security;
create policy "Users manage own weekly focuses" on public.weekly_focuses
  using (exists (select 1 from public.goals where id = goal_id and user_id = auth.uid()));

-- DAILY TASKS
create table public.daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  date date not null default current_date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.daily_tasks enable row level security;
create policy "Users manage own tasks" on public.daily_tasks using (auth.uid() = user_id);

create index daily_tasks_user_date on public.daily_tasks(user_id, date);

-- HABIT STREAKS
create table public.habit_streaks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  task_title text not null,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed date,
  unique (user_id, task_title)
);

alter table public.habit_streaks enable row level security;
create policy "Users manage own streaks" on public.habit_streaks using (auth.uid() = user_id);

-- WEEKLY REVIEWS
create table public.weekly_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_start date not null,
  completed_count integer not null default 0,
  blocked_text text,
  carry_forward_text text,
  rating integer check (rating between 1 and 5),
  ai_insight text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;
create policy "Users manage own reviews" on public.weekly_reviews using (auth.uid() = user_id);

-- ACCOUNTABILITY PARTNERS
create table public.accountability_partners (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  partner_user_id uuid references public.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  unique (user_id, partner_user_id)
);

alter table public.accountability_partners enable row level security;
create policy "Users see own partnerships" on public.accountability_partners
  using (auth.uid() = user_id or auth.uid() = partner_user_id);
