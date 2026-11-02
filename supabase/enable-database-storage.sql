-- ==============================================================================
-- FEELOG T1D: ENABLE DIRECT DATABASE STORAGE ACROSS ALL DEVICES (PHONE + LAPTOP)
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Ensure all tables exist with proper columns
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  height_cm int,
  weight_kg numeric,
  morning_regular_default numeric default 20,
  night_30_70_default numeric default 25,
  created_at timestamptz default now()
);

create table if not exists insulin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default '00000000-0000-0000-0000-000000000001'::uuid,
  log_date date not null,
  log_time time not null,
  insulin_type text not null,
  units numeric not null,
  taken boolean not null default true,
  note text,
  created_at timestamptz default now()
);

create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default '00000000-0000-0000-0000-000000000001'::uuid,
  log_date date not null,
  log_time time not null,
  meal text not null,
  items text not null,
  carb_size text,
  photo_url text,
  carbs_g numeric,
  protein_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  calories numeric,
  note text,
  created_at timestamptz default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default '00000000-0000-0000-0000-000000000001'::uuid,
  log_date date not null,
  log_time time not null,
  activity_type text not null,
  duration_min int,
  intensity text,
  note text,
  created_at timestamptz default now()
);

create table if not exists feel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default '00000000-0000-0000-0000-000000000001'::uuid,
  log_date date not null,
  log_time time not null,
  feel text not null,
  symptoms text[],
  note text,
  created_at timestamptz default now()
);

create table if not exists glucose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default '00000000-0000-0000-0000-000000000001'::uuid,
  log_date date not null,
  log_time time not null,
  reading_mgdl int not null,
  context text,
  note text,
  created_at timestamptz default now()
);

-- 2. Drop restrictive foreign key constraints to auth.users
-- This allows entries to be saved without requiring an email-confirmation auth gate
alter table profiles drop constraint if exists profiles_id_fkey;
alter table insulin_logs drop constraint if exists insulin_logs_user_id_fkey;
alter table food_logs drop constraint if exists food_logs_user_id_fkey;
alter table activity_logs drop constraint if exists activity_logs_user_id_fkey;
alter table feel_logs drop constraint if exists feel_logs_user_id_fkey;
alter table glucose_logs drop constraint if exists glucose_logs_user_id_fkey;

-- 3. Set default user_id so inserts without user_id succeed automatically
alter table insulin_logs alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;
alter table food_logs alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;
alter table activity_logs alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;
alter table feel_logs alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;
alter table glucose_logs alter column user_id set default '00000000-0000-0000-0000-000000000001'::uuid;

-- 4. Enable Row Level Security (RLS) and grant open access for the app
alter table profiles enable row level security;
alter table insulin_logs enable row level security;
alter table food_logs enable row level security;
alter table activity_logs enable row level security;
alter table feel_logs enable row level security;
alter table glucose_logs enable row level security;

-- Drop previous restrictive policies
drop policy if exists "Users can manage own insulin logs" on insulin_logs;
drop policy if exists "Users can manage own food logs" on food_logs;
drop policy if exists "Users can manage own activity logs" on activity_logs;
drop policy if exists "Users can manage own feel logs" on feel_logs;
drop policy if exists "Users can manage own glucose logs" on glucose_logs;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Allow all on profiles" on profiles;
drop policy if exists "Allow all on insulin_logs" on insulin_logs;
drop policy if exists "Allow all on food_logs" on food_logs;
drop policy if exists "Allow all on activity_logs" on activity_logs;
drop policy if exists "Allow all on feel_logs" on feel_logs;
drop policy if exists "Allow all on glucose_logs" on glucose_logs;

-- Create policies allowing direct read/write for your mobile and laptop app
create policy "Allow all on profiles" on profiles for all using (true) with check (true);
create policy "Allow all on insulin_logs" on insulin_logs for all using (true) with check (true);
create policy "Allow all on food_logs" on food_logs for all using (true) with check (true);
create policy "Allow all on activity_logs" on activity_logs for all using (true) with check (true);
create policy "Allow all on feel_logs" on feel_logs for all using (true) with check (true);
create policy "Allow all on glucose_logs" on glucose_logs for all using (true) with check (true);

-- 5. Enable Supabase Realtime publication on all tables for instant multi-device sync
alter publication supabase_realtime add table profiles, insulin_logs, food_logs, activity_logs, feel_logs, glucose_logs;
