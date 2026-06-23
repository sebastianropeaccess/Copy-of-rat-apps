# PRD.md — RAT Apps Master Requirements & Guidelines

## 1. Purpose & Platform Context
Rope Access Technicians (RATs) is moving all remaining Google AppSheet applications into the internal portal. The goal is not to copy AppSheet screen-for-screen, but to rebuild each workflow properly inside the RAT Apps platform so it is faster, cleaner, easier to use in the field, and ready for future automation.

**Platform Constraints:**
- **Production domain:** `apps.ropeaccess.com.au`
- **Codebase:** `projects/rat-apps/app/` (Vercel project `rat-apps`)
- **Backend:** Supabase (Database + Storage)
- **Auth:** Existing PIN login system. Do NOT create a separate login system.
- **Benchmark:** The *Simple Repair* app is the absolute benchmark for design, mobile usability, and syncing behavior.

---

## 2. Core Design Philosophy & Execution Rules

### 2.1 Usable While "On Rope" (Mobile-First)
The field team uses these apps in difficult conditions: gloves, glare, one-handed use, fatigue, poor signal, and time pressure.
- Buttons must be large enough to tap comfortably on mobile (touch targets ≥ 48px).
- Avoid tiny checkboxes, cramped dropdowns, and dense desktop-style tables.
- Reduce typing through presets, chips, scanning, photo capture, and smart defaults.
- Keep the most common workflow on as few screens as possible.

### 2.2 Redesign, Don't Copy AppSheet
AppSheet forced certain layouts and compromises. For each app, ask:
- What is the actual job? Which fields are genuinely needed in the field vs. office?
- Can information be grouped better or automated?
- Split workflows into field capture vs. office review.

### 2.3 Syncing & Performance (Critical)
Avoid the AppSheet problem where phones get bogged down syncing large datasets.
- **Never load the whole DB onto the phone.** Use job/user/date/asset filters.
- Be offline/poor-connection tolerant.
- Store large media separately and load thumbnails. Push photos to storage without blocking the whole workflow.
- Show pending/synced/error states clearly.
- Prefer server-side processing for heavy tasks (like PDF generation).

### 2.4 Automation Mindset
Design with future automation in mind (even for phase 1):
- Auto-generate reports from field data.
- Notify managers when gear is due for service.
- Prevent broken gear from being assigned.
- Pre-fill forms based on job, employee, or site.

---

## 3. Priority Roadmap

**Recommended build order:**
1. ~~Gear Registry + Test And Tag + Asset Management~~ *(Completed/Foundation)*
2. **Height Safety And Inspections reporting app** *(Current Priority)*
3. SWMS and Toolbox Talk workflows
4. Leave Request
5. Personal Gear
6. Staff Reviews and Checklist

*(Note: Purchase Receipt, Sales app, and Simple Repair are explicitly OUT OF SCOPE for Sebastian. Leave these to Chay unless directed otherwise).*

---

## 4. Apps In Scope (Specific Requirements)

### 2. Height Safety And Inspections App

**Context:** There is already a new “Height Safety And Inspections App” built from the “Simple App Benchmark Guidelines” and deployed on the Vercel ecosystem.

**Purpose:** Edit the current format from the reporting generator feature from the new Height Safety And Inspections App for the “Formal Report Format” which you can found examples at /Users/bastian/Desktop/Claw:Claud Test/rat-apps/docs

**Key requirements:**
- Job/site selection.
- System/component register for each site.
- Inspection status per item/component.
- Photos attached to relevant inspection items.
- Defects, recommendations, corrective actions, and notes.
- Clear pass/fail/attention-required status.
- Ability to mark items as not inspected, inaccessible, replaced, removed, or requiring follow-up.
- Report generation at the end of the workflow.

**Reporting:**
- The report does not need to be 100% completed for delivery, the target is a report that is signed less so the office only has to review, signed, and send it.
- Reports should be generated server-side where possible.
- Reports should include site/job details, inspection summary, itemised findings, photos, recommendations, and any required disclaimers or standards references.
- Manual office review should remain part of the workflow before anything is issued externally.

**Important note:** Australian Standard references must be checked against the current edition before being baked into templates or report wording.

### App 3: SWMS App
**Purpose:** Rebuild the Safe Work Method Statement (SWMS) workflow for field use.
**Key Requirements:**
- Select job/site.
- Select relevant SWMS template or work activity.
- Field team review and sign-on. Record attendees/signatures.
- Store completed SWMS records against the job.
- *Future:* Pull job details from Simpro and attach completed SWMS back to the job.

### App 4: Toolbox Talk App
**Purpose:** Easy mobile workflow for supervisors to conduct job-based safety talks.
**Key Requirements:**
- Job-based toolbox talks. Topic selection.
- Attendance/sign-on. Notes/actions. Clear completed status.
- *Future:* Recurring topics, compliance reminders, automatic summaries.

### App 5: Leave Request App
**Purpose:** Rebuild leave request workflow.
**Key Requirements:**
- Staff submit leave requests from mobile.
- Managers/admin can review, approve, reject, or ask for info.
- Show leave status clearly to employee. Notify relevant people on submission/approval.
- Keep history of requests.
- *Future:* Cross-check leave against job scheduling (Simpro).

### App 6: Personal Gear App
**Purpose:** Track personal gear issued to individual employees.
**Key Requirements:**
- Employee gear profile (issued, returned, replaced, expired, damaged, missing).
- Inspection/expiry/service reminders.
- Sign-off/acknowledgement where required.
- Link to the broader asset register where appropriate.

### App 7: Staff Reviews And Checklist App
**Purpose:** Replace AppSheet staff review workflows.
**Key Requirements:**
- Staff review templates and checklist completion.
- Manager notes and outcomes (ability to separate private manager notes from employee-visible info).
- Status tracking, follow-up actions, date-based reminders.

---

## 5. Definition Of Done (Acceptance Criteria)
An app is NOT finished until:
1. It works smoothly on mobile (usable with gloves/glare).
2. It matches the *Simple Repair* design direction.
3. It uses the existing RAT Apps PIN login pattern.
4. It stores data efficiently in Supabase using a sensible model.
5. It does not overload phones with unnecessary syncing.
6. It displays clear saved/pending/error states.
7. It has been tested with real or realistic data.
8. Chay (or an appointed manager) has reviewed the workflow.
9. Any future automation hooks are documented.
