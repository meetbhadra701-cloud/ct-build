# ComplyTrack — Claude Code Instructions

## Project Overview
Automated Certificate-of-Insurance (COI) tracking for small-to-midsize residential
property managers (50–500 units). Read the COI accurately, judge it against the PM's
requirements, alert on lapses. The judgment is the moat; reminders are commodity.

> **"ComplyTrack" is a placeholder name — it's taken. Do not register anything under it.**

---

## Memory & Vault

The Obsidian vault at `~/ct(obsidian)` is the project brain. Use it as persistent memory
across sessions — read it at the start, write back when things change.
You should never need the human to re-explain a past decision.

### On every session start — READ these files:
- `~/ct(obsidian)/07 Architecture/Architecture.md` — stack decisions + decision log
- `~/ct(obsidian)/08 Agent Coordination/Agent Coordination.md` — who owns what
- `~/ct(obsidian)/06 Product Vision/Product Vision.md` — what's in scope + DO NOT BUILD list
- `~/ct(obsidian)/04 Business Model/Business Model.md` — the boundary (never cross into "advise on adequacy")

### Write back to the vault when:
- **You make or confirm an architectural/stack decision** → append to `07 Architecture/Architecture.md`
  under "Decision Log". Format: `## YYYY-MM-DD — <short title>\n<one or two sentences>`
- **A rejected feature request is confirmed** → log it in `06 Product Vision/Product Vision.md`
  under "Rejected feature requests"
- **A new risk surfaces** → note it in the relevant vault file

### Never:
- Ask the human to update the vault manually — you handle it
- Duplicate repo task logs into the vault — vault holds decisions and narrative only

---

## Architecture

### The #1 rule
Every DB query is scoped by `account_id`. An automated test must prove tenant A cannot read tenant B.

### Core loop (build ONLY this)
ingest → AI extract → deterministic validation → compliance engine → dashboard →
escalating email reminders → immutable audit log → Stripe subscription + plan gating → auth

### Human-in-the-loop (not optional)
AI extracts and scores confidence. Below threshold or contradicting rules → flag to human
reviewer, decision recorded + timestamped. This is the accuracy floor AND the audit-trail defense.

### Extraction
LLM document AI + deterministic validation/normalization layer on top. Never trust raw model output.

---

## Agent Roles

**Claude Code (you) — Senior Architect & Integrator:**
`SCHEMA.md`, `API_CONTRACT.md`, multi-tenant boundary, extraction pipeline design,
compliance logic, payment architecture, background jobs, `ARCHITECTURE.md`, `TASK_STATE.md`

**Codex — High-Speed Implementer:**
CRUD endpoints, React components, form logic, Stripe webhook wiring, date math, tests.
Works only against **frozen** contracts.

**Rule:** never run both agents on the same files simultaneously.
Codex works in its own git worktree (`../ct-codex` branch `codex-work`).

---

## What NOT to Build (v1)
mobile app · SMS/TCPA · multi-user roles · PM-software integrations (AppFolio/Yardi/Buildium) ·
white-label · AI chat · multiple verticals · free tier · **any "we verify your insurance is adequate" feature**

---

## Legal Boundary (hold firmly)
This product is collect / extract / match / track / alert / exception-workflow only.
Never cross into coverage-sufficiency advice. ToS must be attorney-reviewed before first paying customer.
