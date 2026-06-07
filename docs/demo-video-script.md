# ConsentOps demo video script (~3 minutes)

Use this script for Devpost / judging. **Show what the app actually does** — synthetic Ana Reyes data only, not a compliance guarantee. Agent Engine Playground trace, Cloud Run dashboard with MCP discovery panel, BigQuery cleanup when configured.

| | |
|--|--|
| **Target length** | 2:30–3:15 |
| **Audience** | Hackathon judges (Google Cloud + Fivetran partner track) |
| **Hosted URL** | https://consentops-agent-538209538110.us-central1.run.app |
| **Agent Engine playground** | See `consentops-adk/.agent_engine_id` or [agent-builder-setup.md](agent-builder-setup.md) |
| **GitHub** | https://github.com/prabhakaran-jm/ConsentOps-Agent |

**Record counts:** Hosted BigQuery on Cloud Run is typically **25** matches for Ana Reyes. Local JSON fixtures return **37** — do not hardcode either in the Agent; quote tool output.

---

## Devpost attachments checklist

Before submitting on Devpost (Fivetran partner track):

- [ ] Paste **Cloud Run URL**, **Agent Engine playground URL**, and **GitHub URL** (see [devpost-submission.md](devpost-submission.md))
- [ ] Upload **~3 min demo video** (YouTube/Loom) following this script
- [ ] Attach **Playground trace screenshot** — 5 Fivetran tools + 2 ConsentOps tools visible
- [ ] Attach **MCP screenshot** — Cursor MCP settings with `FIVETRAN_ALLOW_WRITES=false` (optional supplement)
- [ ] Attach **dashboard screenshot** — MCP discovery panel + platform status + audit (see [screenshots/README.md](screenshots/README.md))
- [ ] Select **Fivetran** partner track; paste elevator pitch from devpost-submission.md

---

## Agent Engine Playground (0:00–0:45)

**On screen:** Vertex AI Agent Engine playground. Prompt: *"Ana Reyes withdrew consent. Run Fivetran discovery, scan the warehouse, and build a cleanup plan."*

**Say:**

> ConsentOps on Agent Engine runs a mandatory playbook: five read-only Fivetran tools via Cloud Run, then warehouse scan and Gemini plan. The trace is the proof — not a single black-box HTTP call.

**On screen:** Expand trace — zoom on `get_account_info`, `list_connections`, `get_connection_details`, `get_connection_state`, `list_destinations`, then `consentOpsScanWarehouse`, `consentOpsBuildPlan`.

**Say:**

> Scan returns the exact record count from BigQuery — **25 on our hosted demo** — plus connector summary. Execution stays in the web UI; the agent does not delete data.

---

## Cloud Run dashboard — scan + MCP panel (0:45–1:30)

**On screen:** Open Cloud Run URL → click **Scan data spread**. Show match count (**25**), spread map, **Fivetran MCP discovery** panel (5 tools + lineage chips), connector status sidebar.

**Say:**

> The dashboard mirrors the same MCP discovery chain server-side. Judges see tool trace and pipeline lineage without opening the Playground. Fivetran is read-only metadata — cleanup is approval-gated on synthetic BigQuery.

---

## Plan (1:30–1:50)

**On screen:** Click **Generate cleanup plan**. Point to badge: **Planned by Gemini** or **Deterministic fallback planner**.

**Say:**

> Gemini on Cloud Run proposes classified actions — delete, anonymize, retain, review — with deterministic safety validation. Payment records stay retain-only. Agent Engine may use a different Gemini model tier per Vertex constraints; both paths share the same safety rules.

---

## Approval gate (1:50–2:05)

**On screen:** In **Approval**, select 2–3 **delete** actions (not all matches). Show count selected.

**Say:**

> Nothing destructive runs automatically. A human selects exactly which action IDs to approve.

---

## Execute + live re-scan (2:05–2:30)

**On screen:** Click **Execute approved cleanup**. Show success; audit panel updates from “No execution yet”.

**Say:**

> Only approved actions run. ConsentOps re-scans the warehouse afterward — remaining counts come from a **live re-scan**, not self-reported numbers.

---

## Audit + architecture (2:30–3:00)

**On screen:** Open **Audit report** — before/after (e.g. 25 → 22 after partial deletes), disclaimers. Optional one-slide architecture: MCP → BigQuery scan → Gemini plan → human execute → re-scan audit.

**Say:**

> The audit summarizes connectors inspected, actions taken, and honest remaining matches. MCP for pipeline context, BigQuery for governed cleanup, human approval in the middle.

**Closing card:**

- **Live demo:** https://consentops-agent-538209538110.us-central1.run.app
- **Repo:** https://github.com/prabhakaran-jm/ConsentOps-Agent
- **Not legal advice · synthetic data only**

---

## Do not claim in the video

- GDPR / regulatory certification or legal advice
- Real customer data or production Fivetran/BigQuery mutations via MCP
- Autonomous deletion without human approval
- That Fivetran MCP performs cleanup (metadata only; cleanup is approval-gated on synthetic BigQuery demo data)
