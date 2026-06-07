# Devpost submission copy (ConsentOps Agent)

Copy/paste and adapt for [Devpost](https://devpost.com). Keep claims aligned with the [real vs mocked](../README.md#real-vs-mocked) table.

---

## Project name

**ConsentOps Agent**

---

## Tagline (one line)

Operational agent for consent withdrawal: find synthetic subject data, classify cleanup, require human approval, execute safely, and document results — powered by Gemini (optional) on Google Cloud.

---

## Elevator pitch (≈50 words)

ConsentOps helps teams operationalize consent withdrawal after data has spread across synced systems. It scans a demo warehouse, proposes record-scoped cleanup with Gemini or a deterministic fallback, blocks unsafe actions, requires explicit human approval before execution, re-scans to verify, and produces an audit trail. **Synthetic demo data only — not a compliance guarantee.**

---

## Inspiration

Consent withdrawals are operational nightmares: data fragments across CRM, commerce, support, marketing, analytics, and payments. Policy decks do not delete rows. We built an agent-shaped workflow that mirrors how data teams actually work — discover, plan, approve, act, prove — with safety as the default.

---

## What it does

- Scans **7 warehouse tables** for a synthetic subject (Ana Reyes) — **25** on hosted BigQuery, **37** on local JSON fixtures
- Shows **Fivetran** pipeline context — **Option 1 MCP (primary, read-only)** plus **REST status panel (secondary)** in the web UI
- Generates a **classified cleanup plan** (`delete` / `anonymize` / `retain` / `review`)
- Enforces **safety policy** (no table-wide deletes; payments retain-only)
- Requires **human approval** before any destructive action
- **Re-scans** after execution for honest remaining counts
- Publishes a structured **audit report** (after successful approved execution only)

---

## How we built it

| Layer | Technology |
|-------|------------|
| App | Next.js 16, TypeScript, Tailwind |
| Planning | Google Gemini API (optional) + deterministic fallback with zod validation |
| Hosting | Docker + Google Cloud Run (`--max-instances=1` for demo state) |
| Data movement (Fivetran partner) | **Option 1 MCP (primary)** — read-only connector metadata; **Option 2 REST** mirrors status in UI |
| Warehouse | Google BigQuery (`bigquery_full`) — synthetic `consentops_demo`; live re-scan after cleanup |
| Agent integration | ADK Agent Engine (Fivetran trace + scan/plan) + Cloud Run dashboard; OpenAPI for legacy Agent Builder |
| Tests | Vitest — safety policy, planner fallback, API routes, no secret leakage |

---

## Challenges we ran into

- **Honest provenance:** Gemini plans must pass deterministic safety checks; we surface fallback in the UI instead of hiding failures.
- **Demo state:** In-memory workflow on Cloud Run — single instance required so judges do not split across containers.
- **Partner proof:** Fivetran MCP (read-only, `FIVETRAN_ALLOW_WRITES=false`) for agent-native pipeline context; cleanup is approval-gated on BigQuery demo data, not via Fivetran APIs.

---

## Accomplishments that we're proud of

- End-to-end **human-in-the-loop** demo with live re-scan verification
- **Fivetran MCP (primary)** read-only partner path documented; **REST panel** mirrors connector status for the web demo
- **Vertex AI Agent Builder** chat front-end via OpenAPI tool — execution stays in the web UI
- Judge-friendly **platform status** endpoint with no secrets in responses

---

## What we learned

Operational consent tooling is about **coordination and proof**, not autonomous deletion. Adapters (Fivetran, BigQuery) should stay read-only or metadata-only until policy, approval, and audit are bulletproof.

---

## What's next

- Durable workflow state for multi-session demos
- Wire `DEMO_MODE` to runtime adapter selection everywhere

---

## Built with (checkboxes)

- [x] Google Cloud / Gemini API
- [x] Google Cloud Run
- [x] Google BigQuery (`bigquery_full` — scan, execute, live re-scan)
- [x] Fivetran — **Option 1 MCP (primary, read-only)** + Option 2 REST UI mirror
- [x] Vertex AI Agent Builder (OpenAPI chat front-end — see [agent-builder-setup.md](agent-builder-setup.md))

---

## Links

| Link | URL |
|------|-----|
| **GitHub** | https://github.com/prabhakaran-jm/ConsentOps-Agent |
| **Live demo (Cloud Run)** | https://consentops-agent-538209538110.us-central1.run.app |
| **Demo video** | _paste YouTube/Loom URL after recording (~3 min; see demo-video-script.md)_ |

---

## Try it out (for judges)

1. Open the **Cloud Run URL** (or run locally: `npm run dev`).
2. **Scan data spread** → **25** matches on Cloud Run (BigQuery); **37** locally.
3. **Generate cleanup plan** → note Gemini vs deterministic badge.
4. Select a few actions → **Execute approved cleanup**.
5. Review **audit report** and platform status card.

Optional: `curl -s -X POST https://consentops-agent-538209538110.us-central1.run.app/api/agent/plan -H "Content-Type: application/json" -d '{}'`

---

## Safety & honesty (include in submission notes)

- **Not** legal advice or GDPR certification
- **Synthetic data only** — do not submit real PII
- **No secrets** in the repository; use Secret Manager for `GEMINI_API_KEY` on Cloud Run
- Fivetran **Option 1 MCP (primary):** [fivetran-mcp-evidence.md](fivetran-mcp-evidence.md) — `COMPLETED` sanitized capture; `FIVETRAN_MCP_RUNTIME=true` for runtime MCP locally
- **Gemini model:** Cloud Run planner defaults to `gemini-3.5-flash` (`GEMINI_MODEL`). Agent Engine on Vertex may use a different Gemini tier per platform constraints — both paths use the same deterministic safety validation; we label planner source in the UI.

---

## Related docs

- [README](../README.md)
- [Platform proof plan](platform-proof-plan.md)
- [Demo video script](demo-video-script.md)
- [Cloud Run deployment](cloud-run-deployment.md)

---

## Devpost submit checklist (manual)

1. Select **Fivetran** partner track.
2. Paste links: GitHub + Cloud Run URL (table above).
3. Record ~3 min video per [demo-video-script.md](demo-video-script.md); paste video URL when ready.
4. Attach MCP screenshot (`FIVETRAN_ALLOW_WRITES=false`) + dashboard screenshot ([screenshots/README.md](screenshots/README.md)).
5. Set GitHub About: MIT license, description, topics; confirm repo is public.
