---
name: Mindful Glycemic Interface
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: 4rem
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.5rem
    fontWeight: '700'
    lineHeight: 3rem
    letterSpacing: -0.01em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.01em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.6rem
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.4rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.04em
  label-numeric:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2rem
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is engineered for people living with Type 1 Diabetes, delivering a non-judgmental, serene, and ultra-rapid tracking environment. Managing chronic endocrine health carries cognitive and emotional fatigue; therefore, the UI strictly eliminates alarms, clinical sterile whites, and high-anxiety data displays in favor of a calm, mindful sanctuary that enables frictionless 5-second logging.

The aesthetic blends **Dark-Mode Minimalism**, **Soft Neumorphism**, and **Frosted Glassmorphism**:
- **Atmosphere:** Deep, restorative ambient mesh foundations that reduce retinal strain during midnight checks and early morning spikes.
- **Tactility:** Extruded soft-glass interactive elements with subtle dual-source ambient lighting, giving tactile weight to dosage entries and physical relief to daily tracking.
- **Language & Tone:** Empathetic, empowering, and clinical without being cold. Metrics are contextualized as informative states rather than moral grades.

## Colors

The system uses a dark mode paradigm anchored by an oceanic, midnight ambient foundation paired with semantic state indicators:

- **Surface Base:** Midnight slate (`#0f172a`), accented with deep oceanic teal (`#0f766e`) and nocturnal indigo (`#1e1b4b`) in soft mesh gradients.
- **Primary / In-Range & Taken:** Mint Emerald (`#10b981` / hover `#34d399`) indicates glycemic stability, completed basal doses, and balanced states.
- **Secondary / Kinetic & Insulin:** Electric Cyan (`#06b6d4`) highlights active insulin on board (IOB), physical exercise, and sensor calibrations.
- **Tertiary / Elevated:** Warm Amber (`#f59e0b` / glow `#fb923c`) signals upward trends and elevated glucose levels without alarming urgency.
- **Urgent / Hypo Alert:** Soft Ruby Coral (`#ef4444` / soft `#f87171`) designates low or dropping readings, paired with prominent contrast for immediate accessibility.
- **Neutrals & Texts:**
  - `text-primary`: Pure crisp white (`#ffffff` at 100%) for critical metric readouts.
  - `text-secondary`: Soft slate mist (`#cbd5e1` at 70%) for baseline telemetry, timestamps, and units.
  - `text-muted`: Dim slate (`#64748b` at 50%) for subtle contextual descriptors.

## Typography

The typography couples the friendly, human geometric geometry of **Plus Jakarta Sans** for primary metrics and narrative guidance with the structural clarity of **Inter** for data tags, micro-labels, and metadata.

- **Numeric Scaling:** Primary blood glucose (BG) numbers utilize `display-lg` with tightened tracking (`-0.02em`) to ensure instant glanceability in low-light environments.
- **Hierarchy:** Strict two-tone hierarchy ensures users parse their primary reading instantly, with unit markers (`mg/dL` or `mmol/L`) set in `label-md` using uppercase letter-spacing to prevent visual crowding.
- **Reading Comfort:** Body copy maintains relaxed line heights (`1.6rem` on `1rem` font) to foster a calm, editorial feel across logs and notes.

## Layout & Spacing

The layout uses a 12-column responsive fluid grid designed around single-hand thumb zones for mobile devices and centered, tranquil dashboard views for wide screens.

- **Mobile (< 768px):** 4-column flow with `1rem` margins and gutters. Primary actions and the quick-log tactile dial stay anchored inside the bottom 40% of the viewport.
- **Tablet (768px - 1024px):** 8-column layout with `2rem` margins. Split view prioritizing real-time telemetry on the left, daily trend logs on the right.
- **Desktop (> 1024px):** 12-column layout maxed out at `1200px` content container width with `3.5rem` margins, avoiding wide eye-travel and maintaining visual intimacy.
- **Rhythm:** Spacing relies on a clean 8pt coordinate system (`0.5rem`, `1rem`, `1.5rem`, `2.5rem`) to guarantee balanced white space between floating glass cards.

## Elevation & Depth

Visual hierarchy is constructed through layers of translucent frosted glass and soft, dual-directional neumorphic lighting:

- **Ambient Background Mesh:** A fixed viewport gradient transitioning smoothly between `#0f172a`, `#0f766e` at 15% opacity, and `#1e1b4b` at 25% opacity.
- **Card Surfaces (Frosted Glassmorphism):**
  - Fill: `rgba(255, 255, 255, 0.04)` to `rgba(255, 255, 255, 0.07)`
  - Backdrop Blur: `16px` with saturation boost (`backdrop-filter: blur(16px) saturate(180%)`)
  - Border: `1px solid rgba(255, 255, 255, 0.08)` on lower edges, fading from `rgba(255, 255, 255, 0.16)` on the top border to mimic an overhead physical key light.
  - Inner Glow: `inset 0 0 20px rgba(255, 255, 255, 0.03)` for internal ambient diffusion.
- **Neumorphic Extrusions (Interactive Glass):**
  - Default Elevated: Outer shadow of `0 10px 25px -5px rgba(0, 0, 0, 0.35)`, coupled with a soft upper highlight `inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)`.
  - Depressed / Pressed State: Drop shadows collapse, substituted by `inset 0 2px 6px rgba(0, 0, 0, 0.45)` with subtle saturation damping.
- **Status Halos:** Glycemic status accents apply a gentle ambient drop-glow (e.g., `0 0 30px rgba(16, 185, 129, 0.15)` for in-range readings).

## Shapes

The design system embraces an ultra-rounded, organic shape language to convey physical softness, comfort, and psychological safety.

- **Base Radius (Pill & Curvature):** Interactive pills, buttons, and state tags utilize full continuous curvature (`rounded-full` / `9999px`).
- **Cards & Enclosures:** Glass modules use roundedness level 3 (`1rem` to `2rem`), softening visual boundaries and reinforcing the perception of floating, tactile instrumentation.
- **Input Fields & Steppers:** Dosage increments and numeric controls sit inside pill capsules (`rounded-full`), welcoming direct tap interactions.

## Components

### Buttons & Quick-Log Triggers
- **Primary Action (Log Entry):** Pill-shaped, high-translucency cyan or emerald glass base with a subtle top rim-light. On hover or tap, triggers a spring transition (`cubic-bezier(0.34, 1.56, 0.64, 1)`) with a gentle outward status glow (`0 0 20px rgba(16, 185, 129, 0.3)`).
- **Secondary Action:** Ghost pill with `1px rgba(255, 255, 255, 0.12)` border, filling to `rgba(255, 255, 255, 0.08)` on hover.

### Symptom & Context Chips
- **Tag Pills:** Capsule chips (`rounded-full`) padded with `0.5rem 1rem`. Unselected state sits at `rgba(255, 255, 255, 0.04)` with muted text.
- **Active State:** Extruded soft-glass highlight; text becomes crisp white, matching status tint (e.g., Amber for "Brain Fog / High", Coral for "Shaky / Low", Teal for "Post-Workout").

### Inputs & Dosage Steppers
- **Insulin & Carb Counter:** Centered high-contrast numeric display flanked by rounded neumorphic minus (`-`) and plus (`+`) pill buttons. Direct input uses a semi-transparent inset fill (`rgba(0, 0, 0, 0.25)`) with an active focus glow matching the active metric color.
- **Unit Toggles:** Compact sliding segment pill with frictionless micro-animations.

### Glycemic Overview Card
- **Primary Hero Glass Container:** Houses real-time blood glucose, rate-of-change trend arrow, and contextual status banner ("In Range • 84% Today"). Backed by a soft ambient radial light corresponding to the active metabolic state.
- **Chart Area:** Sparklines and spline curves rendered with glowing neon vectors, floating over minimal grid markers with zero visual noise.

### Checkboxes & Segmented Selectors
- **Toggles:** Smooth pill track with an extruded floating glass knob that shifts color upon toggling to reflect completed basal injection or meal bolus delivery.