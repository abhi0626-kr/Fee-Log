-- ==============================================================================
-- FEELOG T1D: ADD SETTINGS & DOCTOR DETAILS TO PROFILES TABLE
-- Run this script in Supabase: SQL Editor -> New Query -> Run
-- This allows Doctor Name, Clinic, Emergency Phone, and Settings to sync
-- automatically across your laptop and mobile phone!
-- ==============================================================================

-- 1. Add settings JSONB column and individual fields to profiles
alter table profiles add column if not exists settings jsonb default '{}'::jsonb;
alter table profiles add column if not exists doctor_name text;
alter table profiles add column if not exists clinic_name text;
alter table profiles add column if not exists doctor_phone text;
alter table profiles add column if not exists emergency_contact_phone text;
alter table profiles add column if not exists residence_area text;
alter table profiles add column if not exists native_location text;
alter table profiles add column if not exists lifestyle_note text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists age int;
alter table profiles add column if not exists gender text;
alter table profiles add column if not exists food_chips text[];
alter table profiles add column if not exists updated_at timestamptz default now();

-- 2. Ensure open access for cross-device synchronization
alter table profiles enable row level security;
drop policy if exists "Allow all on profiles" on profiles;
create policy "Allow all on profiles" on profiles for all using (true) with check (true);

-- 3. Enable realtime updates for profiles (safely handles if already added)
do $$
begin
  alter publication supabase_realtime add table profiles;
exception
  when duplicate_object then null;
end $$;
