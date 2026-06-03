# TASK_STATE.md

## CONTRACTS

- `SCHEMA.md`: **frozen v1** on 2026-06-03
- `API_CONTRACT.md`: **frozen v1** on 2026-06-03
- Codex worktree: ✓ created at `../ct-codex` on branch `codex-work`

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
- Phase 0 + Phase 1 COMPLETE: ✓ build (Next 16 / Tailwind v4), ✓ typecheck, ✓ tests (2/2 pass), contracts frozen v1, Drizzle migration generated, vault Decision Log updated.
- Supabase project `ct-build` (ylncnjleylmbzklmqafk) created and healthy — West US (Oregon), NANO compute.
- Migration applied: 13 tables live in Supabase PostgreSQL 17.6.
- audit_log immutability trigger active (blocks UPDATE + DELETE).
- .env.local written (gitignored); DATABASE_URL uses session pooler (IPv4 compatible).

## IN PROGRESS

- Phase 2 extraction pipeline: typecheck in progress

## BLOCKED

- (none — migration applied, all keys in .env.local)

## NEXT CODEX TASKS

- [DONE] `/lib/dates` — implemented in ct-codex worktree, 12/13 tests pass. One failing test:
  `tests/dates/expiry.test.ts:80` — off-by-one in 14-day reminder schedule for 2028-03-01 expiry.
  Expected `2028-02-15` but Feb 15 is 15 days before March 1, not 14. Fix the expected value.
- Codex: write extraction validation tests (`tests/extraction/validate.test.ts`)
  covering parseDollarAmount, parseDate, validateAndNormalize edge cases.
- Codex: write CRUD route handlers for vendors, certificates, requirements per API_CONTRACT.md.
