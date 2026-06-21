# HANDOFF_CLAWBOT.md — RAT Apps Project Handoff

> **Audience:** Incoming Project Manager taking over the RAT Apps platform.
> **From:** Lead Developer.
> **Date:** 2026-06-18.
> **Purpose:** A single, exhaustive context document. Everything you need — architecture, what's been built, design decisions, and the development rules we've learned the hard way — is here. Read this top to bottom before touching anything.

---

## 0. TL;DR (read this if nothing else)

- **RAT Apps** is the unified field-app platform for Rope Access Technicians, live at **apps.ropeaccess.com.au**.
- ~22 rope access techs + office staff use it daily, **on phones, in the field** (glare, gloves, patchy signal). Mobile-first is not optional.
- **Stack:** Next.js 15/16 (App Router, TS) + Tailwind v4 + Supabase (Postgres + Storage) + Google Drive backup, hosted on **Vercel**.
- **Auth is PIN-based**, not email/password. No Supabase Auth users — identity lives in the `team_members` table and `localStorage`.
- The Next.js project root is **`app/`**, NOT the git repo root. Get this wrong and every route 404s on a "successful" deploy.
- **Latest milestone:** App 1 — **Asset Management** — shipped June 2026. It replaces three legacy AppSheet apps. Details in §4.
- There is a registered, reusable **`/rebuild-app` skill** that codifies how we port legacy AppSheet apps into this platform. Use it for the next ones. See §6.

---

## 1. Repository Layout

The git repo root is `rat-apps/`. **The Next.js app is the `app/` subdirectory.** This trips everyone up — internalize it.

```
rat-apps/                         ← git repo root (NO package.json here)
├── HANDOFF.md                    ← short original handoff (superseded by this file)
├── HANDOFF_CLAWBOT.md            ← this document
├── TABLES-NEEDED.sql             ← early/legacy schema notes
├── migrations/                   ← repo-root legacy migration (002_candidates.sql)
├── claude:skills:rebuild-app:/   ← the registered "rebuild-app" skill (see §6)
│   └── App Benchmark skill.md
├── .claude/
│   └── settings.local.json       ← local Claude Code permission allowlist (dev tunnels, curl checks)
└── app/                          ← *** THE NEXT.JS APP — Vercel root directory ***
    ├── CLAUDE.md                 ← canonical engineering context (keep this updated)
    ├── package.json              ← deploys MUST run from here
    ├── lib/                      ← supabase.ts, helpers.ts, types.ts, offline.ts
    ├── app/                      ← App Router routes, one folder per module
    ├── supabase/migrations/      ← *** canonical migration folder (001–005) ***
    ├── migrations/               ← stray legacy migration (002_features.sql)
    └── public/
```

> **Migration folder note:** there are THREE migration folders (`rat-apps/migrations`, `app/migrations`, `app/supabase/migrations`). The **authoritative one going forward is `app/supabase/migrations/`** (001 → 005). The other two are historical leftovers. Consolidating them is a good early cleanup task but low priority.

---

## 2. Technical Architecture

### 2.1 Framework & hosting
- **Framework:** Next.js (App Router, TypeScript). `package.json` currently pins `next 16.2.1`, `react 19.2.4`. (CLAUDE.md says "Next.js 15" — the codebase has since moved to 16; treat 16 as truth.)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`).
- **Hosting:** Vercel, Git-integrated. Production domain **apps.ropeaccess.com.au**.
- **Notable deps:** `@supabase/supabase-js` + `@supabase/ssr`, `jspdf` + `pdf-lib` (PDF report generation), `sharp` (image processing), `pg` (direct Postgres access for migrations/scripts).

### 2.2 Database & storage — Supabase
- **Postgres** instance at `https://jbtvgtezllfvjrpkmyge.supabase.co`.
- **Supabase Storage** for photos (public buckets). Photos are *also* mirrored to **Google Drive** via a fire-and-forget API call for backup/business access.
- **Row Level Security** is enabled on the asset tables, but policies are currently **permissive** (`anon` + `service_role` can do everything). This is by design *for now* because auth is PIN-based and there are no real Supabase Auth JWTs to gate on. **This is a known security trade-off — see §7.**

### 2.3 Cloudflared / localtunnel — the field-testing pipeline
This is critical institutional knowledge that isn't obvious from the code.

Because the #1 rule is "must work on real iPhones and Androids in the field," we **do not** trust the desktop browser or simulators. The dev workflow is:

1. Run the app locally: `cd app && npm run dev` (serves `http://localhost:3000`).
2. Expose localhost to the public internet so a real phone can hit it:
   - **Cloudflared** (`cloudflared tunnel`) — preferred, stable named tunnels.
   - **localtunnel** (`npx localtunnel`, `*.loca.lt`) — quick throwaway tunnels (e.g. `ropeaccess-assets-demo.loca.lt`). Note localtunnel injects a reminder interstitial; bypass it with the `bypass-tunnel-reminder: 1` header (you'll see this all over `.claude/settings.local.json`).
3. Open the tunnel URL on the physical device, log in with a PIN, and exercise the flow with gloves/in sunlight.
4. We use lightweight `curl` health checks against `/login` and `/assets` (timed, with `%{http_code}`) plus "watchdog" scripts (`tunnel-watchdog`, `lt-watchdog`) to keep tunnels alive and confirm routes respond.

> **Why it matters:** `cloudflared`/`localtunnel` are **dev/QA tooling, not production infra.** Production is Vercel. Don't confuse the two. The tunnel allowlist entries in `.claude/settings.local.json` are pre-approved commands so the agent can spin tunnels up/down without prompting.

### 2.4 The four library files (`app/lib/`)
- `supabase.ts` — exports `getSupabase()`, the singleton client. Always go through this.
- `helpers.ts` — `getStoredUser()` / `clearStoredUser()` (PIN-auth identity), plus the **asset allocation queue** helpers (`getAllocationQueue` / `setAllocationQueue` / `clearAllocationQueue`, keyed `asset_allocation_queue` in localStorage).
- `types.ts` — all shared TypeScript interfaces. The Asset Management types live under the `// === Asset Management ===` block (`Asset`, `AssetCategory`, `AssetStatus`, `AssetInspection`, `AssetAssignment`, `AssignmentType`).
- `offline.ts` — IndexedDB offline queue (originally built for Repairs; auto-syncs when connectivity returns).

---

## 3. Auth System (PIN-based — read carefully, it's unusual)

- **No email/password and no Supabase Auth.** Every team member has a **4-digit PIN**.
- On login, the matching `team_members` row is stored in `localStorage` as `rat_user` (JSON). `getStoredUser()` reads it.
- Authorization is driven by columns on `team_members`:
  - `position === 'Manager'` → sees **every** app automatically.
  - `can_view_all_data` → also unlocks everything.
  - `can_manage_settings` → gates the admin apps (`team`, `external-users`).
  - `can_access_apps` (text[]) → for everyone else, an app tile shows only if its `appKey` is in this array.
- The home grid (`app/app/page.tsx`) applies all of this filtering client-side.

> **Implication for the PM:** access control is **client-side and trust-based**, backed by permissive RLS. It's fine for an internal trusted team of 22, but it is NOT a hardened security boundary. Keep this in mind before exposing anything externally. (See §7.)

---

## 4. App 1 — Asset Management (the headline achievement)

### 4.1 What it replaced and why
Three legacy **AppSheet** apps were consolidated into one:
- **Gear Registry** — had **20+ near-identical tabs**, one per gear type. Massive data bloat, slow sync, awful UX.
- **Test & Tag** — electrical testing records.
- **Tools & Equipment Assets** — general tool tracking.

**The core design insight:** instead of one tab/table per gear type, use **a single `assets` table** with `category` + `asset_type` + a flexible `metadata JSONB` column. This kills the bloat and makes sync fast.

### 4.2 Database schema (migrations `004_assets.sql` + `005_assignment_updates.sql`)

Three tables, all with `updated_at` trigger on `assets`, indexes, RLS, and a dedicated storage bucket.

**`assets`** — master record for every physical item:
- `id uuid` (auto, `gen_random_uuid()` — **never send your own id**), `item_number`, `asset_type`, `category`, manufacturer/model/serial, the four lifecycle dates (manufacture / purchase / first use / retirement), `status`, `current_assignee_name`, `metadata jsonb`, `comments`, audit fields.
- `nfc_tag_id` and `barcode` columns exist but are **NULL until NFC hardware arrives** (forward-provisioned — see §4.5).
- **`category` CHECK:** `rope_access_gear, height_safety, tools, electrical, consumables, plant, vehicles, job_kits`.
- **`status` CHECK:** `available, assigned, on_job, in_service, broken, retired, lost, quarantine`.

**`asset_inspections`** — unified PPE checks + Test & Tag history:
- `inspection_type` ∈ `routine_ppe, test_and_tag, visual`; `result` ∈ `pass, fail, conditional_pass`; `inspection_date`, `next_due_date`, `action_required`, `photo_urls text[]`.

**`asset_assignments`** — check-in / check-out ledger (polymorphic):
- `assigned_to_type` ∈ `person, vehicle, storage_location, job`; `assigned_to_id` (text), `assigned_to_name` (denormalized for fast render), `job_id`, `checked_out_at`, `checked_in_at`, `processed_by`, `notes`.
- **`expected_return_date date`** added in migration `005` — powers the "Asset Not Available till X days" warning in the allocation flow.

**Storage bucket:** `asset-inspections` (public) for inspection photos.

### 4.3 The route structure (refactored June 2026 to a "Storeman-first" layout)
We deliberately moved from a generic list-first layout to an **action-first hub** built around how the storeman actually works. The old `/assets` list, `/assets/scan`, and `/assets/[assetId]/inspect` pages were **removed** (you'll see them as deletions in git status).

Asset Management (`/assets`):
- `/assets` — **landing hub: 3 big buttons** → Asset Allocation, Log New Asset, Asset Status Report.
- `/assets/allocation` — build a checkout list. **localStorage-cached queue** so a half-built list survives the app closing. "Add via ID typing" modal + "Search Asset from List". Items currently out are greyed with "Asset Not Available till X days". A **disabled Scan icon** is present (UI placeholder for future NFC). "Assign this List" → assign step.
- `/assets/allocation/search` — multi-select search + category chips; merges the selection back into the queue.
- `/assets/allocation/assign` — Person* / Car (optional) / Job* / Returning Date* with green-check completion. Inline "+Add new" for Car (inserts a `vehicles` row) and Job (free text; the Job list = distinct past `job_id`s). **No inline person-create** (creating a person needs PIN/auth → directs the user to the Team app). On confirm it re-checks availability, then per asset inserts an `asset_assignments` row (`type=person`, `expected_return_date`, car stored in `notes`) and sets the asset `status='on_job'` + `current_assignee_name`.
- `/assets/new` — create flow: category → type → core fields → metadata → dates.
- `/assets/report` — the old list view, repurposed: a 4-stat bar that is now **clickable as filters** (combinable with category chips + search), plus a "History" button.
- `/assets/report/history` — allocation history log (`asset_assignments` joined to `assets`).
- `/assets/[assetId]` — asset detail. "Log Inspection" now routes to `/inspections/[id]`; "Assign" routes to `/assets/allocation`.
- `/assets/[assetId]/edit` — edit all fields + manual status override + delete.

Inspections (split into its **own portal app**, `/inspections`):
- `/inspections` — asset picker with **Overdue / Due / Up-to-date** badges, sorted most-due-first, with search + due filter.
- `/inspections/[assetId]` — the Log Inspection form (moved out of `/assets`). Reads/writes the **same** `asset_inspections` / `assets` tables and the `asset-inspections` bucket. Business rules: a **Fail → asset status `broken`**, a **Conditional pass → `quarantine`**.

### 4.4 Home-page registration
Both apps are registered in the `apps` array in `app/app/page.tsx`:
- `{ name: 'Asset Management', icon: 'package', color: 'bg-amber-600', appKey: 'asset-management' }`
- `{ name: 'Inspections', icon: 'clipboard-check', color: 'bg-teal-600', appKey: 'inspections' }`
- A `package` SVG was added to the `AppIcon` switch for the Asset Management tile.

### 4.5 Known scope boundaries on App 1
- **NFC / barcode scanning is "Later" scope.** The DB columns (`nfc_tag_id`, `barcode`) and the disabled Scan icon exist as forward-provisioning; what's missing is the actual input/read method (waiting on hardware).
- **Car is recorded in the assignment `notes` field, not its own column.** If car-as-first-class-data becomes a requirement, that's a schema change.
- Assignment in the current UI **always** uses `assigned_to_type='person'` + `status='on_job'`. The older vehicle / storage_location / job assignment-type code paths (from the removed `/assets/scan`) **no longer have a UI**, even though the table still supports them. Don't assume those paths are exercised.

---

## 5. Other modules already on the platform (inherited, pre-App-1)

These predate the Asset Management work and are in varying states of maturity. **Simple Repair is the gold-standard benchmark** — when in doubt about UX/sync/architecture, copy how Repairs does it.

| Route | Module | Notes |
|---|---|---|
| `/repairs` | **Simple Repair** | The benchmark. Main daily-use app. Has the offline queue. |
| `/dashboard` | Ops Dashboard | Simpro-powered |
| `/pipeline` | Sales Pipeline | HubSpot-powered |
| `/site-visits`, `/site-visit` | Site Visits | `/site-visit` is an older localStorage prototype; see `app/SITE-VISIT-BRIEF.md` |
| `/jobs` | Jobs | Simpro-powered |
| `/drop-tracker` | Drop Tracker | |
| `/receipts` | Purchase Receipts | AI scanning via GPT-4o-mini (`/api/scan-receipt`) |
| `/timesheet` | Timesheets | |
| `/leave` | Leave Requests | |
| `/toolbox-talk` | Toolbox Talks | |
| `/sds` | SDS / TDS register | Google-Drive-powered, AI product search |
| `/gear` | Gear Registry | **Legacy — superseded by Asset Management. Candidate for retirement.** |
| `/hss` | HSS Inspection | |
| `/inspection` | Facade Inspection | |
| `/facade-repair` | Facade Repair | Detailed variant |
| `/broken-gear` | Broken Gear | |
| `/candidates` | Candidate screening | |
| `/supervisor` | Supervisor Review | |
| `/team` | Team management (admin) | gated by `can_manage_settings` |
| `/external` | External user management | gated by `can_manage_settings` |
| `/swms` | SWMS | **"Coming Soon" — not built** (tile is disabled) |

### Key API routes (`app/app/api/`)
`/api/simpro`, `/api/simpro-jobs`, `/api/jgid-jobs` (job systems) · `/api/hubspot` (pipeline) · `/api/scan-receipt` (GPT-4o-mini OCR) · `/api/search-sds` + `/api/sds-drive` (AI SDS search + Drive listing) · `/api/upload-to-drive` (photo backup, fire-and-forget) · `/api/repairs/report` (PDF generation).

---

## 6. The `rebuild-app` skill (how we scale to App 2, 3, …)

There is a **registered Claude Code skill** at `claude:skills:rebuild-app:/App Benchmark skill.md` (name: `rebuild-app`, `disable-model-invocation: true` — so it only runs when explicitly invoked). It codifies our porting playbook so each legacy-AppSheet → RAT-Apps rebuild is consistent.

**What it enforces:**
1. **Benchmark first** — analyze the existing **Simple Repair** app before writing anything new. It is the reference for design, syncing, and architecture.
2. **Architecture & design rules (from the PRD):**
   - Mobile-first & field-ready: design for glare and gloves; big buttons; no dense desktop tables on phones.
   - Minimal typing: chips, smart defaults, UI prepped for NFC/barcode.
   - **Syncing is critical:** never load the whole DB onto the phone — filter by job/user/date. Show pending/synced/error states clearly. Be offline-tolerant.
   - Reuse the existing Supabase schema + PIN auth. **No new databases.**
3. **Execution discipline:** ask for the AppSheet workflow/data structure → propose the Supabase schema changes → propose the mobile UI flow → **wait for human approval before generating code.**

> **PM takeaway:** when you commission the next app rebuild, invoke this skill rather than briefing from scratch. Asset Management (App 1) is itself a worked example of the skill's output and a second reference alongside Simple Repair.

---

## 7. Development rules & hard-won lessons (DO NOT relearn these the hard way)

### Deploy
- **The Vercel Root Directory MUST be `app/`.** There is no `package.json` at the repo root.
  - CLI: `cd app && VERCEL_TOKEN=… npx vercel --prod --yes`.
  - Dashboard: Project Settings → Build & Deployment → **Root Directory = `app`**.
  - **Failure symptom:** deploy reports "Ready" but `/`, `/login`, `/assets` all 404 — because Vercel built from the repo root where there's no Next app. If you see universal 404s after a green deploy, this is almost always the cause.

### Database / Supabase
1. **Never send a client-generated `id` in inserts.** All ids are DB-generated (`uuid` via `gen_random_uuid()`, or serial integers on older tables).
2. **`floor_number` is TEXT**, not a number — it carries `"G"` (ground), `"R"` (roof), `"B1"` (basement), etc. Don't "fix" it to an integer.
3. Standard insert pattern: `await getSupabase().from('table').insert({...}).select().single()`.
4. RLS is currently permissive (`anon`/`service_role` allow-all). **Known trade-off** given PIN auth — don't expose externally without revisiting this.

### Mobile / field behavior (these are non-negotiable)
5. **Test on a real iPhone AND a real Android before declaring anything done.** Use the cloudflared/localtunnel pipeline (§2.3). Desktop-only "looks fine" is not acceptance.
6. **Do NOT use `navigator.onLine`** — it lies on mobile. Always *attempt* the network call first, then fall back to the offline queue.
7. **Do NOT use `capture="environment"`** on file inputs — it breaks Android. Let the OS present the camera/gallery chooser.
8. **Photos must work offline** — route them through the offline queue (`lib/offline.ts`), which auto-syncs on reconnect.
9. Photos go to Supabase Storage **and** are mirrored to Google Drive via `/api/upload-to-drive` (fire-and-forget, must never block the user).

### UI / design system
- **Mobile-first, max content width ~480px**, centered.
- **Theme:** light bg `#f5f5f0` (Tailwind `bg-light-gray`), navy text/headers `#1a1f36` (`bg-navy`), orange accent `#f97316` (`bg-orange`).
- **Touch targets ≥ 48px.** Cards = white `rounded-xl`/`rounded-2xl` + `shadow-sm`. Headers = `bg-navy text-white`, sticky. Always include a back arrow. Always show loading spinners/skeletons and **user-friendly errors — never fail silently.**

### Adding a new app module (the recipe)
1. Create `app/app/<module>/` with `page.tsx` (list/hub) and `new/page.tsx` (create form).
2. Register it in the `apps` array in `app/app/page.tsx` with a unique `appKey` (and an `AppIcon` case if it needs a new icon).
3. Managers see it automatically; everyone else needs the `appKey` added to their `team_members.can_access_apps`.

---

## 8. Credentials & secrets

All secrets live as **Vercel environment variables** (nothing sensitive is committed; `.env.local` is git-ignored). The variables in play:
- `NEXT_PUBLIC_SUPABASE_URL` (= `https://jbtvgtezllfvjrpkmyge.supabase.co`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (receipt scanning + SDS search)
- `HUBSPOT_ACCESS_TOKEN`
- `GOOGLE_SA_PRIVATE_KEY` + `GOOGLE_DRIVE_PHOTOS_FOLDER_ID` (Drive service account)
- `SIMPRO_API_KEY` + `SIMPRO_BASE_URL`

**Google Shared Drives:** *Apps.RopeAccess* (app data — repair photos, SDS/TDS docs) and *Da Vinci* (deliverables, standards, project docs).

> **Action for PM:** confirm you have access to the Vercel project, the Supabase project, and both Shared Drives on day one. Real secret values are transferred only through the agreed secure handoff path — never in git, chat, or this file.

---

## 9. State of the working tree at handoff

`git status` shows the Asset Management refactor is **committed conceptually but not yet all committed to git** — there are staged deletions (old `/assets/scan`, `/assets/[assetId]/inspect`), modified files (`page.tsx`, `helpers.ts`, `types.ts`, `CLAUDE.md`, `package.json`), and untracked new directories (`/assets/allocation`, `/assets/report`, `/inspections`) plus the new migration `005_assignment_updates.sql` and the `rebuild-app` skill folder.

**First housekeeping task:** review and commit the Asset Management work as a clean, well-described commit, then run migration `005` against Supabase if it hasn't been applied. Verify with the field-testing pipeline before merging.

The last clean commits on `main` are:
- `1dfd465 feat: launch new Asset Management app with Supabase schema`
- `4d95ee3 Initial commit`

---

## 10. Suggested first-week priorities for the new PM

1. **Get access** — Vercel, Supabase, both Google Shared Drives (§8).
2. **Commit & deploy the Asset Management refactor** cleanly; confirm migration `005` is applied (§9).
3. **Field-validate App 1** on a real iPhone + Android via a tunnel (§2.3) with the storeman.
4. **Decide the fate of the legacy `/gear` module** — it's superseded by Asset Management and should be sunset to avoid confusion.
5. **Plan App 2** using the `rebuild-app` skill (§6); the obvious candidates are whatever AppSheet apps remain.
6. **Schedule a security review** of the permissive-RLS / client-side-auth model (§3, §7) before any external exposure.

---

*Keep `app/CLAUDE.md` as the living engineering source of truth and update it as the platform evolves. This document is the point-in-time handoff snapshot for 2026-06-18.*
