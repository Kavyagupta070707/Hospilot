# Hospilot Widget - KavyaGupta

Implementation for Part 1 of the Hospilot full-stack assessment.

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:3001
```

## How it works

The browser talks only to this local Node backend:

- `POST /api/sessions` logs into Hospilot, prefixes the goal with `[CANDIDATE-KavyaGupta]`, and creates a non-autonomous planning session.
- `GET /api/sessions/:sessionId` polls Hospilot until the returned `pipeline` is non-empty.
- When the plan is ready, the frontend opens `https://hospilot.carer.ai` in an iframe and sends the exact widget handoff message with `postMessage`.

Credentials are loaded from `.env` for local testing. `.env` is ignored by the repository and should not be committed.

## Deploy on Vercel

Use `widget/KavyaGupta` as the Vercel project root.

Add these Vercel environment variables for Preview and Production:

```text
HOSPILOT_USERNAME=medcity_doc_1
HOSPILOT_PASSWORD=123456
```

Then deploy:

```bash
vercel deploy
vercel deploy --prod
```

The deployed app serves `index.html` and uses Vercel functions in `api/` for Hospilot login, session creation, and polling.

If Vercel asks for build settings, use:

```text
Framework Preset: Other
Build Command: leave empty
Output Directory: leave empty
Install Command: npm install
```
