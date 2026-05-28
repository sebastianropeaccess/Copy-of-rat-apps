# RAT Apps Handoff

RAT Apps is the unified field-app platform for apps.ropeaccess.com.au.

The main Next.js app lives in `app/`.

## Local Setup

```bash
cd app
cp .env.example .env.local
npm ci
npm run dev
```

Environment values are not committed. Get the real values through the agreed secure handoff path.

## Vercel

Use the `app/` directory as the Vercel project root.

Production deployment target: `apps.ropeaccess.com.au`.

## Important Notes

- Keep all new RAT Apps modules inside this codebase.
- Do not create a parallel Vercel project or a separate app platform.
- Simple Repair is the current benchmark module for UI and workflow quality.
