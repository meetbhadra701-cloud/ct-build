# Architecture

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres, Auth, and Storage signed URLs
- Drizzle ORM + Drizzle Kit migrations
- Anthropic Claude API for extraction, with deterministic validation/normalization before persistence
- Stripe for billing in a later phase

## Data Flow

Upload or forwarded email creates a tenant-scoped certificate record, queues extraction, stores raw model output and normalized validation output, routes low-confidence or contradictory results to HITL review, evaluates against requirement templates, writes immutable audit events, and schedules vendor reminders.

## Safety Boundaries

- Every tenant-scoped table has `account_id`.
- Every tenant-scoped query must filter by authenticated `account_id`.
- Tenant A must never be able to read tenant B data.
- The product tracks and matches requirements; it does not advise whether coverage is adequate.
