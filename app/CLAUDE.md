# CLAUDE.md — RAT Platform Context

## Project Overview
Field apps platform for Rope Access Technicians (ropeaccess.com.au). Used daily by a team of ~22 rope access technicians + office staff on mobile phones.

## Tech Stack
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (photos) + Google Drive (backup copies)
- **Hosting:** Vercel
- **Domain:** apps.ropeaccess.com.au

## Key Credentials (env vars on Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` = https://jbtvgtezllfvjrpkmyge.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (set in Vercel)
- `HUBSPOT_ACCESS_TOKEN` = (set in Vercel)
- `OPENAI_API_KEY` = (set in Vercel, used for receipt scanning + SDS search)
- `GOOGLE_SA_PRIVATE_KEY` = (set in Vercel, service account for Drive)
- `GOOGLE_DRIVE_PHOTOS_FOLDER_ID` = (set in Vercel)
- `SIMPRO_API_KEY` + `SIMPRO_BASE_URL` = (set in Vercel)

## Deploy
The Next.js project root is the `app/` subdirectory (this folder), NOT the git repo root.
There is no package.json at the repo root, so deploys MUST run from here.
```bash
# Run from the app/ directory (this folder):
cd app   # if you're at the repo root
VERCEL_TOKEN="TU_VERCEL_TOKEN_AQUI" npx vercel --prod --yes
```
If deploying via the Vercel dashboard / Git integration instead of the CLI,
set Project Settings → Build & Deployment → **Root Directory = `app`**.
Symptom of getting this wrong: deploy is "Ready" but every route (/, /login, /assets) 404s,
because Vercel built from the repo root where there is no Next.js app.

## Auth System
- **PIN-based login** — no email/password. Each team member has a 4-digit PIN.
- User stored in localStorage as `rat_user` (JSON of team_members row)
- `getStoredUser()` from `lib/helpers.ts` returns the logged-in user
- `RatUser` type from `lib/types.ts`
- Team members stored in Supabase `team_members` table
- Managers (position='Manager') see all apps automatically
- Other users only see apps listed in their `can_access_apps` array

## Key Files
- `lib/supabase.ts` — Supabase client (`getSupabase()`)
- `lib/helpers.ts` — `getStoredUser()` helper
- `lib/types.ts` — All TypeScript interfaces (Repair, RatUser, TeamMember, etc.)
- `lib/offline.ts` — IndexedDB offline queue for repairs (auto-syncs when online)
- `app/page.tsx` — Dashboard/home page with app tiles

## Database Tables (Supabase)
- `team_members` — id, name, pin, position, role, active, can_access_apps (text[]), can_view_all_data, can_manage_settings
- `repairs` — id (serial), building_id, building_name, drop_label, floor_number (text), defect_type, sub_type, location, repair_number, initial_photo_url, initial_photo_urls (text[]), status, created_by, etc.
- `repair_steps` — id, repair_id, step_number, step_name, photo_url, comments, created_by
- `repair_buildings` — id, name, address, floor_count, drops (text[])
- `purchase_receipts` — id, team_member_name, date, store_name, items, photo_url, status
- `toolbox_talks` — id, topic, presented_by, attendees, etc.
- `timesheets` — id, team_member_name, date, hours, etc.
- `leave_requests` — id, team_member_name, type, start_date, end_date, status

## Storage Buckets (Supabase)
- `repairs` — repair photos (public bucket)
- `repair-photos` — legacy bucket
- `drop-photos` — drop tracker photos
- `timesheets` — timesheet attachments
- `documents` — general documents

## Current App Modules
Each is a folder under `app/`:
- `/login` — PIN login
- `/dashboard` — Ops dashboard (Simpro data)
- `/repairs` — Simple Repair Tracker (main app being used)
- `/toolbox-talk` — Toolbox talks
- `/receipts` — Purchase receipts with AI scanning (GPT-4o-mini)
- `/timesheet` — Timesheets
- `/leave` — Leave requests
- `/jobs` — Jobs (Simpro-powered)
- `/drop-tracker` — Drop tracker
- `/pipeline` — Sales pipeline (HubSpot-powered)
- `/site-visit` — Site visit app (localStorage prototype)
- `/sds` — SDS/TDS register (Google Drive-powered)
- `/gear` — Gear registry
- `/hss` — HSS inspection
- `/inspection` — Facade inspection
- `/facade-repair` — Detailed facade repair
- `/candidates` — Candidate screening
- `/supervisor` — Supervisor review
- `/team` — Team management (admin)
- `/external` — External user management

## Design Guidelines
- **Mobile-first** — everything must work on phones (iPhone + Android)
- **Theme:** Light background (#f5f5f0), navy text (#1a1f36), orange accents (#f97316)
- **Touch targets:** Minimum 48px height for buttons
- **Cards:** White rounded-xl with shadow-sm
- **Headers:** bg-[#1a1f36] text-white sticky top
- **Back navigation:** Always include back arrow in header
- **Loading states:** Show spinner or skeleton
- **Error handling:** Always show user-friendly error messages, never fail silently

## Common Patterns

### Adding a new app module
1. Create folder under `app/your-module/`
2. Add `page.tsx` (list view) and `new/page.tsx` (create form)
3. Add to the apps array in `app/page.tsx` with appKey
4. Manager users see it automatically; others need appKey added to their `can_access_apps`

### Photo upload pattern
```typescript
const { error } = await getSupabase().storage.from('repairs').upload(path, file)
const { data } = getSupabase().storage.from('repairs').getPublicUrl(path)
```

### Database insert pattern
```typescript
const { data, error } = await getSupabase().from('table').insert({...}).select().single()
// DON'T send 'id' field — Supabase auto-generates it
```

### Google Drive upload
Photos also go to Google Drive via `/api/upload-to-drive` (fire-and-forget, non-blocking).

## Critical Rules
1. **floor_number is TEXT** — supports "G" (ground), "R" (roof), "B1" (basement), numbers
2. **Never send client-generated 'id' in inserts** — Supabase auto-generates integer IDs
3. **Don't use `navigator.onLine`** — unreliable on mobile. Always try online first.
4. **Don't use `capture="environment"`** — breaks Android. Let OS handle camera/gallery choice.
5. **Test on both iPhone and Android** before declaring done
6. **Photos must work offline** — offline queue in lib/offline.ts handles queuing

## API Routes
- `/api/simpro` — Simpro proxy
- `/api/simpro-jobs` — Simpro jobs
- `/api/hubspot` — HubSpot pipeline data
- `/api/scan-receipt` — GPT-4o-mini receipt scanning
- `/api/search-sds` — AI SDS product search + auto-download to Drive
- `/api/sds-drive` — List SDS/TDS docs from Google Drive
- `/api/upload-to-drive` — Upload photos to Google Drive
- `/api/repairs/report` — Generate repair PDF reports
- `/api/jgid-jobs` — JGID job lookup

## Shared Drives (Google)
- **Apps.RopeAccess** — app data (repair photos, SDS/TDS docs)
- **Da Vinci** — deliverables, standards, project docs
