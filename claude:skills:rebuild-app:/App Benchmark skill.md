---
name: rebuild-app
description: Rebuilds a legacy AppSheet app into the RAT Apps Next.js/Supabase portal based on the Simple Repair benchmark.
disable-model-invocation: true
---

## Objective
You are tasked with rebuilding the legacy AppSheet app: **$ARGUMENTS** into the modern Next.js/Supabase portal.

## 1. The Benchmark (Mandatory Reference)
Before writing any new code, you MUST analyze the codebase for the existing **"Simple Repair"** app within `projects/rat-apps/app/`. This is your benchmark for design, syncing, and architecture.

## 2. Architecture & Design Rules (From PRD)
* **Mobile-First & Field-Ready:** Design for difficult field conditions (glare, gloves). Buttons must be large; avoid tiny checkboxes or dense desktop-style tables on mobile.
* **Minimal Typing:** Prioritize chips, smart defaults, and prepare the UI for NFC/barcode scanning.
* **Syncing (Critical):** Do NOT load the entire database into the phone. Use job/user/date filters. Show pending/synced/error states clearly (Offline-tolerant).
* **Backend:** Use the existing Supabase schema and PIN authentication system. No new databases.

## 3. Execution Steps
When I invoke this skill for a specific app, you must:
1. Ask me for the AppSheet workflow details or current data structure.
2. Outline the proposed Supabase database schema updates.
3. Propose the new mobile-first UI flow.
4. Wait for my approval before generating the Next.js code.
