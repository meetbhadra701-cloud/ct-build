# ComplyTrack — Codex Instructions

## Project Overview
Automated Certificate-of-Insurance (COI) tracking for small-to-midsize residential
property managers (50–500 units). Read the COI accurately, judge it against the PM's
requirements, alert on lapses. The judgment is the moat; reminders are commodity.

> **"ComplyTrack" is a placeholder name — it's taken. Do not register anything under it.**

---

## Memory & Vault

The Obsidian vault at `~/ct(obsidian)` is the project brain. Use it as persistent memory
across sessions — read it at the start, write back when things change.

### On every session start — READ these files:
- `~/ct(obsidian)/07 Architecture/Architecture.md` — stack decisions, schema notes
- `~/ct(obsidian)/08 Agent Coordination/Agent Coordination.md` — who owns what
- `~/ct(obsidian)/06 Product Vision/Product Vision.md` — what's in scope + DO NOT BUILD list

### Write back to the vault when:
- **You make an implementation decision** → append to `07 Architecture/Architecture.md`
  under "Decision Log". Format: `## YYYY-MM-DD — <short title>\n<one or two sentences>`

### Never:
- Ask the human to update the vault manually — you handle it
- Build against a contract that isn't marked **frozen** in TASK_STATE.md

---

## Agent Roles

**Codex (you) — High-Speed Implementer:**
CRUD endpoints, React components, form logic, Stripe webhook wiring, date math, tests.
Work only against **frozen** contracts from Claude Code.

**Claude Code — Senior Architect & Integrator:**
`SCHEMA.md`, `API_CONTRACT.md`, multi-tenant boundary, compliance logic, `TASK_STATE.md`

**Rule:** never run both agents on the same files simultaneously.
You work in your own git worktree (`../ct-codex` branch `codex-work`).

### Yield & Pivot
If blocked waiting on a frozen contract: log the dependency, commit progress, switch to
an independent task. Never idle, never guess a schema shape.

---

## The #1 rule
Every DB query is scoped by `account_id`. A test must prove tenant A cannot read tenant B.

---

## What NOT to Build (v1)
mobile app · SMS/TCPA · multi-user roles · PM-software integrations · white-label · AI chat ·
multiple verticals · free tier · **any "we verify your insurance is adequate" feature**
