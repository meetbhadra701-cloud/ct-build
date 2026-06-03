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
- Phase 2 COMPLETE: extraction pipeline (lib/extraction/, lib/storage/, lib/db/) committed. ✓ tsc, ✓ 2/2 tests.
- Phase 3 COMPLETE: compliance engine (lib/compliance/engine.ts). Template rules vs coverages → compliance_results. Expiry priority: non-compliant > expired > expiring-soon > compliant. ✓ tsc, ✓ 2/2 tests.
- Phase 4 COMPLETE: HITL resolver (lib/hitl/resolver.ts). resolveReview(): approve/reject, apply reviewer corrections, re-evaluate compliance, immutable audit_log. ✓ tsc, ✓ 2/2 tests.
- Phase 5 COMPLETE: Stripe payments (lib/payments/). stripe.ts singleton, checkout.ts (14-day trial, card required), portal.ts, webhooks.ts (sig-verified; 4 events: checkout.session.completed, subscription.updated/deleted, invoice.payment_failed). ✓ tsc, ✓ 2/2 tests.

## IN PROGRESS

- (none)

## BLOCKED

- (none — migration applied, all keys in .env.local)

## NEXT CODEX TASKS

- [DONE] `/lib/dates` — implemented in ct-codex worktree, 12/13 tests pass. One failing test:
  `tests/dates/expiry.test.ts:80` — off-by-one in 14-day reminder schedule for 2028-03-01 expiry.
  Expected `2028-02-15` but Feb 15 is 15 days before March 1, not 14. Fix the expected value.
- Codex: write extraction validation tests (`tests/extraction/validate.test.ts`)
  covering parseDollarAmount, parseDate, validateAndNormalize edge cases.
- Codex: write CRUD route handlers for vendors, certificates, requirements per API_CONTRACT.md.
- [DONE by Codex] POST /api/reviews/:id/resolve + GET /api/reviews — on codex-work.
- Codex: implement POST /api/stripe/checkout and POST /api/stripe/portal routes (call lib/payments/checkout.ts and lib/payments/portal.ts).
- Codex: implement POST /api/webhooks/stripe route: read raw body as Buffer, call verifyAndParseWebhook(), then processWebhookEvent(). Return 400 on bad signature, 200 on success or unknown event.
