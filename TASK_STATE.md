# TASK_STATE.md

## CONTRACTS

- `SCHEMA.md`: **frozen v1** on 2026-06-03
- `API_CONTRACT.md`: **frozen v1** on 2026-06-03
- Codex worktree: pending creation at `../ct-codex` on branch `codex-work`

## DONE

- Read project vault session-start files.
- Verified `find-skills` installation with `npx skills add https://github.com/vercel-labs/skills --skill find-skills`.
- Established secret-safe `.gitignore` before app scaffold files.
- Added `.env.example` placeholders only.
- Added minimal Next.js App Router + TypeScript scaffold.
- Added Supabase browser/server client helpers.
- Added Drizzle schema for frozen v1 tables.
- Froze `SCHEMA.md` v1 and `API_CONTRACT.md` v1.
- Added architecture and rejected-feature documentation stubs.
- Added cross-tenant isolation security test.

## IN PROGRESS

- Phase 0 + Phase 1 scaffold verification.

## BLOCKED

- Applying the generated Drizzle migration to Supabase is blocked until `DATABASE_URL` is provided in `.env.local` or the environment.

## NEXT CODEX TASKS

- After verification, create `../ct-codex` on `codex-work`.
- Codex may then implement `/lib/dates` expiry/reminder utilities and tests against frozen v1 contracts.
