# T1D Log — Personal Type 1 Diabetes Tracking Web App

A personal, mobile-first, privacy-respecting progressive web application (PWA) tailored for a 20-year-old student living in a Bangalore PG managing Type 1 Diabetes with fixed insulin doses (Morning: 20U Regular, Night: 25U 30/70) without a fingerstick meter in the city.

---

## ⚠️ Hard Constraints & Safety Non-Negotiables
1. **Glucose reading is always optional/nullable**: Every database layer, API, UI view, chart, and correlation rule handles `glucose == null` gracefully.
2. **Never suggests insulin doses or adjustments**: The app strictly displays logged data and detects deterministic retrospective patterns.
3. **Persistent Disclaimer**:
   > *"Patterns derived from your own logs. This is not medical advice and does not replace glucose testing or your doctor's guidance."*
4. **Feel ratings are subjective symptom logs**: Never labeled or conflated with blood sugar numbers.
5. **No AI/LLM hallucinations in v1**: Pure deterministic functions over personal data.
6. **Mobile-first PWA**: Works offline, installable to phone home screen, fast optimistic writes.

---

## 🛠 Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database / Auth / Storage**: Supabase (Postgres, Auth magic link, Storage) + Local-First IndexedDB/LocalStorage fallback with offline sync queue
- **Visualizations**: Recharts
- **Clinical Export**: jsPDF + jsPDF-AutoTable (clean doctor PDF) + RFC4180 CSV export
- **Timezone**: Stored in UTC; rendered in `Asia/Kolkata` (IST)

---

## 🚀 Key Features

### 1. Quick Log (`/`)
- Log today's events in **under 30 seconds**.
- Top header with IST local date and consecutive local logging streak counter.
- **Conditional Glucose Prompt**: Shows at most once per calendar day only if no glucose reading exists; easily dismissed without nagging.
- **Pre-filled Insulin Card**: Morning Regular (20U) and Night 30/70 (25U) one-tap `Taken ✓` and `Edit` buttons.
- **Four Big Action Buttons**: `+ Food`, `+ Activity`, `+ Feel`, and `+ Glucose` (touch targets ≥44px).
- **Merged Chronological Feed**: View today's events sorted by time with edit and delete actions.

### 2. Entry Sheets (Modals)
- **Food Sheet**: Auto-defaults meal type by IST hour (`<11` breakfast, `11–16` lunch, `16–19` snack, `>19` dinner); quick-pick chips for South Indian PG staples (`idly`, `dosa`, `rice`, `chapathi`, `dal/sambar`, `curd`, `egg`, `tea/coffee`); segmented carb portion sizes (Small / Medium / Large); optional photo capture.
- **Activity Sheet**: Quick pre-fills (`Morning run (5–10 km)`, `Evening calisthenics (30–45 min)`), duration numeric input, intensity segmented control.
- **Feel Sheet (≤2 taps to save)**: 5 large color-coded buttons (`Low` #dc2626, `Slightly low` #f59e0b, `Okay` #16a34a, `Slightly high` #fb923c, `High` #ea580c) with contextual hypo vs. hyper symptom checklists.
- **Glucose Sheet**: 20–800 mg/dL validation, context picker (`fasting`, `post_lunch`, `pre_bed`, `other`), optional note.

### 3. Day Timeline (`/timeline`)
- Date picker with previous/next day navigation and `Today` quick jump.
- 05:00 to 24:00 vertical marker timeline.
- **Side-by-side pairing**: If a feel log and glucose log occur within 30 minutes, they are visually highlighted side-by-side.
- Complete day log table with edit/delete controls.

### 4. Deterministic Patterns Engine (`/patterns`)
Selectable 7 / 14 / 30-day window:
1. **High-after-lunch frequency**: Correlates afternoon feels (14:00–19:00) with days having lunch.
2. **Low on skipped/delayed lunch**: Identifies days where lunch was missed or delayed past 14:00 and low feelings occurred.
3. **Carb-size comparison**: Groups afternoon feels by lunch carb size (Small, Medium, Large) in a bar chart.
4. **Meal-item flag**: Scans lunch items for South Indian PG staples (`rice`, `dosa`, `idly`, `chapathi`).
5. **Run-day vs. no-run-day feel distribution**: Compares feel outcomes on running days vs. rest days.
6. **Feel vs. glucose calibration**: Pairs feel logs with glucose readings within 30 minutes. Renders *"Not enough data yet — keep logging."* when `<3` readings exist.

### 5. Weekly Summary (`/summary`)
- Feel ratings distribution breakdown.
- Average lunch time in IST.
- Logging consistency metric.
- Running days vs. rest days count.
- 4-week trend of high-feel occurrences.

### 6. Clinical Export (`/export`)
- **Doctor PDF**: Printable, clean clinical report with patient metadata (age, height, weight), current fixed regimen, day-by-day table, persistent disclaimer footer, and copy: *"Bring this to your endocrinologist to discuss your insulin regimen."*
- **CSV Download**: Columns: `date, time, category, insulin_type/meal/activity/feel, units/items/duration/feel_level, carb_size, symptoms, glucose_mgdl, note`.

### 7. Settings (`/settings`)
- Configurable default insulin doses (20U / 25U).
- Display profile parameters (173 cm, 58 kg).
- Supabase connection settings & magic link auth.
- **Demo Data Seeder**: Loads 14 days of realistic Bangalore PG student logs (Koramangala runs, terrace calisthenics, rice/sambar highs, skipped lunch low) with one click!

---

## 📋 Running Locally
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your browser or mobile device.

---

## 🗄️ Database Setup (Supabase)
Run the SQL schema script in the Supabase SQL Editor:
```bash
# File: supabase/schema.sql
```
This sets up all 6 tables (`profiles`, `insulin_logs`, `food_logs`, `activity_logs`, `feel_logs`, `glucose_logs`), indices on `(user_id, log_date)`, strict Row Level Security (RLS) policies (`auth.uid() = user_id`), and the private storage bucket `food-photos`.
