# Feelog — Mindful Type 1 Diabetes Companion

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth-3ecf8e?logo=supabase)](https://supabase.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **"Calm glass telemetry for Type 1 Diabetes rhythm tracking."**  
> A mobile-first, privacy-respecting Progressive Web Application (PWA) designed for a 20-year-old student living in a Bangalore PG managing Type 1 Diabetes without a fingerstick meter in the city. Built with Next.js 14, Supabase, Tailwind CSS, and an offline-first two-way synchronization engine.

---

## 📑 Table of Contents
1. [Medical Philosophy & Lifestyle Context](#-medical-philosophy--lifestyle-context)
2. [Hard Clinical Constraints & Safety Guarantees](#-hard-clinical-constraints--safety-guarantees)
3. [Architecture & System Design](#-architecture--system-design)
4. [Two-Way Sync & Offline-First Engine](#-two-way-sync--offline-first-engine)
5. [Core Features & User Flows](#-core-features--user-flows)
6. [Deterministic Pattern Engine](#-deterministic-pattern-engine)
7. [Nutrition Tracking & Food Photo Scanner](#-nutrition-tracking--food-photo-scanner)
8. [Database Schema & Supabase Setup](#-database-schema--supabase-setup)
9. [API Route Reference](#-api-route-reference)
10. [Local Development & Setup](#-local-development--setup)
11. [Vercel Deployment Guide](#-vercel-deployment-guide)
12. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🩺 Medical Philosophy & Lifestyle Context

Feelog is built around the specific daily realities of a young student managing Type 1 Diabetes:

- **Location & Lifestyle**: Studying in Koramangala, Bangalore; living in a PG accommodation away from native Tamil Nadu (Coimbatore).
- **The Meterless Reality**: Without a continuous glucose monitor (CGM) or fingerstick meter in the city, glycemic awareness relies on **somatic sensation monitoring ("Zero-Prick" sensory logging)** rather than constant finger pricks.
- **Insulin Regimen**: 2–3 dose split regimen tailored to PG mess eating habits:
  - **Morning**: Regular (R) Insulin (default 20U, administered before breakfast).
  - **Afternoon / Midday**: Regular (R) Insulin (default 10U, optional flexible dose based on PG mess lunch and physical feeling).
  - **Night**: 30/70 Biphasic Mix (default 25U, administered before PG dinner).
  - **Correction**: Regular (R) Insulin (default 4U, as-needed).
- **Fitness Routine**: Active morning distance running (5–10 km around Koramangala park) and PG terrace calisthenics (pull-ups, dips, push-ups).
- **Dietary Staples**: South Indian PG mess fare — idly, dosa, white rice with dal/sambar, curd, chapathi, and sweet canteen filter coffee.

---

## ⚠️ Hard Clinical Constraints & Safety Guarantees

Feelog strictly adheres to essential clinical safety non-negotiables:

1. **Glucose readings are 100% optional and nullable**: Every form, database table, query, and chart handles `glucose == null` gracefully. Zero nagging.
2. **No algorithmic insulin titration or predictive medical advice**: Feelog never suggests changing insulin doses. Dose calculations belong strictly to the patient's endocrinologist.
3. **Subjective symptoms are never labeled as blood glucose numbers**: Feel ratings (*Low*, *Slightly Low*, *Okay*, *Slightly High*, *High*) represent somatic symptom states, not clinical lab numbers.
4. **Deterministic logic only (No AI hallucinations)**: Correlation rules and pattern insights use transparent, verified TypeScript functions.
5. **Persistent Medical Disclaimer**:
   > *"No medical advice · Pure symptom & rhythm tracking for you and your physician. Feelog does not offer clinical insulin titration or predictive medical advice. All data belongs locally to you and your diabetologist."*

---

## 🏛️ Architecture & System Design

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Device                         │
│  (Desktop Browser, Mobile Chrome / Safari PWA Installable)  │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       Optimistic Writes              Hydration & Realtime
       (Local Cache First)            (Focus / Visibility / Polling)
               │                               │
               ▼                               │
┌──────────────────────────────┐               │
│   Browser LocalStorage       │               │
│  - t1d_insulin_logs          │               │
│  - t1d_food_logs             │               │
│  - t1d_activity_logs         │               │
│  - t1d_feel_logs             │               │
│  - t1d_glucose_logs          │               │
│  - t1d_offline_queue         │               │
└──────────────┬───────────────┘               │
               │                               │
       flushOfflineQueue()                     │
      (Two-Way Sync Engine)                    │
               │                               │
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                    Supabase Cloud Backend                   │
│                                                             │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │      Supabase Auth      │   │     Postgres Database   │  │
│  │  - Google OAuth         │   │  - Row-Level Security   │  │
│  │  - Email + Password     │   │  - Realtime Broadcast   │  │
│  └─────────────────────────┘   └─────────────────────────┘  │
│  ┌─────────────────────────┐                                │
│  │     Supabase Storage    │                                │
│  │  - food-photos bucket   │                                │
│  └─────────────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

### Design Highlights:
- **Calm Glass Telemetry**: Dark obsidian canvas (`#0b1326`), ambient teal/indigo/cyan mesh glow orbs, translucent glass containers (`backdrop-blur-2xl`), and Material Symbols font icons.
- **Mobile First Touch Targets**: All interactive elements, buttons, and steppers maintain touch targets $\ge 44\text{px}$.
- **Zero CLS / Hydration Barriers**: SSR placeholder barriers eliminate hydration mismatch flickers on startup.
- **Production-ready Next.js build**: `next build` runs optimized compilation, linting, type validation, and static page generation for Vercel.

---

## 🔄 Two-Way Sync & Offline-First Engine

Feelog implements a resilient, bi-directional synchronization architecture designed to withstand flaky Indian mobile networks:

1. **Instant Optimistic Writes**: Every dose toggle, meal entry, and feel log writes immediately to `localStorage` and updates the React state within milliseconds.
2. **Offline Sync Queue (`t1d_offline_queue`)**: All mutations (insert, update, delete) are queued with ISO timestamps.
3. **Bi-directional Supabase Sync**:
   - **Upload**: Detects any local logs created while offline or prior to authentication and upserts them to Supabase under the user's UUID.
   - **Download**: Queries all user rows from Supabase, merges them without duplicate IDs, and updates local storage.
4. **Instant Action Triggers**: Tapping "Take Dose" or adjusting units immediately triggers a background push to Supabase.
5. **Smart Wakeup / Focus Re-sync**:
   - `window.addEventListener('focus', ...)`
   - `document.addEventListener('visibilitychange', ...)`
   - Switching back to the Feelog tab on your phone or waking up the screen immediately pulls the latest changes made on your laptop.
6. **Graceful Serverless Fallback**: The server database layer (`/api/sync` and `/api/logs`) includes an in-memory fallback to avoid `EROFS: read-only file system` crashes on Vercel Lambda functions.

---

## ⚡ Core Features & User Flows

### 1. Quick Log (`/`)
- **Daily Timeline Stream**: Displays today's events sorted chronologically with status tags (`Scheduled`, `Taken ✓`, `Logged`, `Sensory Log`).
- **Dose Adjustment Steppers**: Adjust morning, midday, and night insulin units on the fly without entering settings.
- **Sensory Sensation Check**: 5-second feel deck with color-coded symptom chips (e.g. *Sluggish*, *Mild Thirst*, *Brain Fog*, *High Energy*).
- **Fast Add Shortcuts**: 1-tap sheets for `+ Food`, `+ Activity`, `+ Feel`, and `+ Sugar`.
- **Logging Streak**: Real-time IST consecutive day logging streak counter.
- **Conditional Daily Glucose Prompt**: Appears at most once per calendar day only if no glucose reading exists; easily dismissed with a single tap.

### 2. Modal Sheets
- **Food Sheet**: Automatically defaults meal type by IST hour (`<11:00` breakfast, `11:00–16:00` lunch, `16:00–19:00` snack, `>19:00` dinner). Features quick-pick South Indian PG chips (*Idly*, *Dosa*, *Rice*, *Dal/Sambar*, *Curd*, *Chapathi*, *Egg*), segmented carb portions (*Small*, *Medium*, *Large*), nutrition estimates, and optional AI-assisted photo scanning.
- **Activity Sheet**: One-tap presets (*Morning run 6.5 km*, *Terrace calisthenics 40m*), duration stepper, and intensity selector.
- **Insulin Sheet**: Direct dose logger supporting all 5 insulin types with customizable timestamps and clinical notes.
- **Glucose Sheet**: 20–800 mg/dL validation range with context picker (*Fasting*, *Post Lunch*, *Pre Bed*, *Other*).

### 3. Day Timeline (`/timeline`)
- Date picker with previous/next day arrows and `Today` quick jump.
- 05:00 to 24:00 vertical marker timeline.
- **Side-by-side Pairing**: When a feel log and a glucose reading occur within 30 minutes of each other, they are visually paired side-by-side to help calibrate somatic awareness against clinical numbers.

### 4. Weekly Summary (`/summary`)
- Feel ratings distribution breakdown.
- Average lunch time in IST.
- Logging consistency metric.
- Running days vs. rest days count.
- 4-week trend of high-feel occurrences.

### 5. Clinical Export (`/export`)
- **Doctor PDF**: Generates a clean, professional clinical report using `jsPDF` and `jspdf-autotable`. Includes a report header, patient vitals (age, height, weight), current fixed regimen, clinical overview cards, clinician observations, a day-by-day detailed telemetry appendix, and doctor footer copy:
  > *"Bring this report to your endocrinologist / diabetologist to discuss your insulin regimen."*
- **RFC4180 CSV Download**: Complete raw export with columns: `date, time, category, insulin_type/meal/activity/feel, units/items/duration/feel_level, carb_size, symptoms, glucose_mgdl, note`.

### 6. User Account & Authentication (`/login`)
- **Google OAuth**: One-click sign-in via Supabase OAuth.
- **Email & Password**: Tabbed interface to switch between **Sign In** and **Create Account**.
- **Sync Now Action**: One-tap manual sync button with real-time feedback.
- **Offline Guest Mode**: Allows completely anonymous, private tracking stored solely in local browser storage.

### 7. Settings (`/settings`)
- Configurable regimen targets (Morning Regular default units, Midday units, Night 30/70 units).
- Native location & clinical contacts (e.g., Dr. S. Ramanathan, MD / Coimbatore Endocrine Clinic / Manipal BLR).
- **Demo Data Seeder**: Populates 14 days of realistic Bangalore PG student telemetry (runs, PG mess meals, afternoon sluggishness, late lunch dip) for instant testing.

---

## 🍽️ Nutrition Tracking & Food Photo Scanner

Food logs can store estimated carbohydrates, protein, fiber, sodium, and calories alongside the meal description. Estimates are calculated from recognized staple foods and portion-size presets, so the tracker remains useful without a photo or network connection.

The Food Sheet also supports an optional AI-assisted photo workflow:

1. Select or capture a meal photo.
2. The server route sends the image to an available Google Gemini vision model.
3. The response is normalized into meal items, carb-size classification, macro estimates, calories, and a short explanation.
4. Review and edit the result before saving it as a food log.

AI output is an estimate, not medical advice or a replacement for nutrition labels or clinician guidance. Configure one of `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `NEXT_PUBLIC_GEMINI_API_KEY` to enable the scanner. The route dynamically discovers supported models and falls back through a ranked list when model availability changes.

## 🧠 Deterministic Pattern Engine

The `/patterns` page executes 6 deterministic statistical rules across selectable 7, 14, or 30-day windows:

| Rule | Name | Deterministic Logic |
|---|---|---|
| **Rule 1** | **High-After-Lunch Frequency** | Scans days with lunch logged; checks if afternoon feels (14:00–19:00) contain `high` or `slightly_high`. Flags if $\ge 50\%$ of lunch days show high symptoms. |
| **Rule 2** | **Low on Delayed/Skipped Lunch** | Identifies days where lunch was missed or delayed past 14:00 and a `low` or `slightly_low` feel was recorded within 2 hours. |
| **Rule 3** | **Carb-Size Comparison** | Correlates lunch carb portion size (*Small*, *Medium*, *Large*) with afternoon feel states; renders a comparative bar chart. |
| **Rule 4** | **Meal-Item Keyword Flagging** | Scans lunch items for keywords (`rice`, `dosa`, `idly`, `chapathi`) and calculates high-feel percentages per food staple. |
| **Rule 5** | **Run vs. Rest Day Distribution** | Compares glycemic feel distributions on morning running days vs. non-running rest days. |
| **Rule 6** | **Feel vs. Glucose Calibration** | Pairs subjective feel logs with objective glucose readings taken within 30 minutes. Renders *"Not enough data yet — keep logging."* when $<3$ paired readings exist. |

---

## 🗄️ Database Schema & Supabase Setup

Run [supabase/schema.sql](./supabase/schema.sql) in your **Supabase SQL Editor**:

```sql
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

-- 2. Insulin Logs Table
create table if not exists insulin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  insulin_type text not null check (insulin_type in ('morning_regular','afternoon_regular','night_30_70','correction','other')),
  units numeric not null,
  taken boolean not null default true,
  note text,
  created_at timestamptz default now()
);

-- 3. Food Logs Table
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  items text not null,
  carb_size text check (carb_size in ('small','medium','large')),
  photo_url text,
  note text,
  created_at timestamptz default now()
);

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

-- 5. Feel Logs Table
create table if not exists feel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  log_time time not null,
  feel text not null check (feel in ('low','slightly_low','okay','slightly_high','high')),
  symptoms text[],
  note text,
  created_at timestamptz default now()
);

-- 6. Glucose Logs Table (Optional / Nullable)
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
```

### Row Level Security (RLS)
All tables enforce strict user isolation:
```sql
alter table insulin_logs enable row level security;
create policy "Users can manage own insulin logs"
  on insulin_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## 📡 API Route Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/logs?table=<table_name>&date=<YYYY-MM-DD>` | Retrieves records from server-side database cache. |
| `POST` | `/api/logs` | Inserts or updates an individual record in server cache. |
| `DELETE` | `/api/logs?table=<table_name>&id=<id>` | Deletes an individual record by ID. |
| `POST` | `/api/sync` | Batch processes offline queue mutations (`insert`, `update`, `delete`). |
| `POST` | `/api/supabase-config` | Configures local Supabase credentials. |
| `POST` | `/api/analyze-food-photo` | Analyzes an optional food image with Gemini and returns normalized nutrition estimates. |

---

## 💻 Local Development & Setup

### Prerequisites
- Node.js 18.x or 20.x
- npm, pnpm, or yarn

### 1. Clone & Install
```bash
git clone https://github.com/abhi0626-kr/Fee-Log.git
cd Fee-Log
npm install
```

### 2. Configure Environment Variables
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
# Optional: enables AI food-photo analysis
GEMINI_API_KEY=your-google-gemini-api-key
```

### 3. Run Automated Tests
```bash
npm test
```
*Executes the repository test suites covering meal hour inference, date calculations, streak algorithms, server DB operations, macro calculations, AI photo-response normalization, and all 6 clinical pattern rules.*

### 4. Validate the Production Build
```bash
npm run build
```
This runs the optimized Next.js compilation, ESLint checks, TypeScript validation, and static page generation.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your browser.

---

## 🚀 Vercel Deployment Guide

1. Push your repository to GitHub.
2. In the **Vercel Dashboard**, click **New Project** and import `Fee-Log`.
3. Add the following **Environment Variables** for **Production**, **Preview**, and **Development**:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Publishable / Anon Key.
   - `GEMINI_API_KEY` (optional): Google Gemini API key for food photo analysis.
4. Deploy. Vercel automatically creates a new deployment for each push to the connected branch.

If a deployment remains marked **Ready / Stale**, open the deployment's **Source** section and confirm it references the latest commit on `main`. A failed build keeps the last successful deployment live; open **Logs** to see lint, type-check, or environment-variable errors before retrying.

### Canonical Domain Routing
[src/middleware.ts](./src/middleware.ts) enforces `fee-log26.vercel.app` as the primary canonical domain, automatically issuing 308 permanent redirects for any temporary Vercel preview aliases to prevent browser storage fragmentation.

---

## ❓ Troubleshooting & FAQs

### Q: Why do my logs show on laptop but not mobile?
Make sure you are signed into the **same Supabase account** (Google or Email/Password) on both devices. The "Offline Guest" mode only stores data inside that specific browser's `localStorage`. Signing in automatically activates the two-way sync engine across all devices.

### Q: Email sign-up says "Email not confirmed"
By default, Supabase requires email verification. You can either:
1. Click the verification link sent to your inbox, or
2. In your **Supabase Dashboard**: Go to **Authentication** → **Providers** → **Email** → Toggle **"Confirm email"** to **OFF** to enable instant password sign-ins.

### Q: `EINVAL: invalid argument, readlink ...\.next\BUILD_ID` on Windows
If you run `npm run build` and then switch to `npm run dev` while the project is in a OneDrive folder, Windows file locking may prevent Next.js from deleting `.next/BUILD_ID`. Simply run:
```powershell
npm run clean
npm run dev
```

### Q: Can I use this app without a glucose meter?
Yes! Feelog was specifically built for this scenario. Every metric, pattern, and timeline view functions fully on insulin and sensory feel logs alone.

---

## 📜 License
This project is open-source under the [MIT License](LICENSE). Feelog is not a medical device. Always consult your diabetologist or endocrinologist before adjusting your insulin regimen.
