# Hospilot Widget - KavyaGupta

Local implementation for Part 1 of the Hospilot full-stack assessment.

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
