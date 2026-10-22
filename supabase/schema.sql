-- T1D Log: Postgres Schema & RLS Setup for Supabase

-- 1. Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  height_cm int,
  weight_kg numeric,
  morning_regular_default numeric default 20,
  night_30_70_default numeric default 25,
  created_at timestamptz default now()
);

-- Enable RLS for profiles
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- 2. Insulin Logs Table
create table if not exists insulin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,              -- local IST date
  log_time time not null,              -- local IST time
  insulin_type text not null check (insulin_type in ('morning_regular','night_30_70')),
  units numeric not null,
  taken boolean not null default true,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_insulin_logs_user_date on insulin_logs(user_id, log_date);
alter table insulin_logs enable row level security;

create policy "Users can manage own insulin logs"
  on insulin_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Food Logs Table
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  items text not null,                 -- e.g. "3 idly, sambar"
  carb_size text check (carb_size in ('small','medium','large')), -- nullable
  photo_url text,                      -- nullable, Supabase Storage
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_food_logs_user_date on food_logs(user_id, log_date);
alter table food_logs enable row level security;

create policy "Users can manage own food logs"
  on food_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Activity Logs Table
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  activity_type text not null check (activity_type in ('run','calisthenics','walk','other')),
  duration_min int,
  intensity text check (intensity in ('light','moderate','hard')),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_activity_logs_user_date on activity_logs(user_id, log_date);
alter table activity_logs enable row level security;

create policy "Users can manage own activity logs"
  on activity_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Feel Logs Table
create table if not exists feel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  feel text not null check (feel in ('low','slightly_low','okay','slightly_high','high')),
  symptoms text[],                     -- e.g. {'shaky','sweaty','thirsty'}
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_feel_logs_user_date on feel_logs(user_id, log_date);
alter table feel_logs enable row level security;

create policy "Users can manage own feel logs"
  on feel_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Glucose Logs Table (optional/nullable)
create table if not exists glucose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  reading_mgdl int not null check (reading_mgdl between 20 and 800),
  context text check (context in ('fasting','post_lunch','pre_bed','other')),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_glucose_logs_user_date on glucose_logs(user_id, log_date);
alter table glucose_logs enable row level security;

create policy "Users can manage own glucose logs"
  on glucose_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. Supabase Storage for Food Photos
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', false)
on conflict (id) do nothing;

create policy "Users can upload their own food photos"
  on storage.objects for insert
  with check (bucket_id = 'food-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own food photos"
  on storage.objects for select
  using (bucket_id = 'food-photos' and auth.uid()::text = (storage.foldername(name))[1]);
