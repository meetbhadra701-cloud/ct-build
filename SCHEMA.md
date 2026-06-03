# SCHEMA.md — Frozen v1

## Contract Status

- Status: **frozen v1**
- Frozen on: 2026-06-03
- Project label: "ComplyTrack" is a placeholder only. Do not register, brand legally, or open external accounts under it.

## Locked Stack

- Framework: Next.js App Router + TypeScript
- Database: Supabase Postgres
- Auth/storage: Supabase Auth + Supabase Storage signed URLs
- ORM/migrations: Drizzle ORM + Drizzle Kit
- Billing: Stripe, deferred until payment phase
- Extraction: Anthropic Claude API plus deterministic validation and normalization before persistence

## Non-Negotiable Boundaries

- Every tenant-scoped table carries `account_id`.
- Every tenant-scoped query filters by authenticated `account_id`.
- Automated tests must prove tenant A cannot read tenant B rows.
- The product collects, extracts, matches, alerts, tracks, and records review decisions. It never advises whether insurance coverage is adequate.
- Raw model output is never trusted directly. Store raw output and deterministic normalized output separately.
- HITL review is required when extraction confidence is below `0.85` or extracted data contradicts requirement rules.

## Enums And Defaults

- Compliance status: `compliant`, `expiring-soon`, `expired`, `non-compliant`
- Certificate status: `processing`, `needs_review`, `approved`, `rejected`
- Certificate source: `upload`, `email`
- Review status: `open`, `resolved`, `dismissed`
- Default expiring-soon window: `30` days, overridable per account requirement template
- Default HITL confidence threshold: `0.85`
- v1 user role: `owner` only

## Tables

### `accounts`

Tenant root.

- `id` uuid primary key
- `name` text required
- `plan` enum `trial | starter | growth`, default `trial`
- `stripe_customer_id` text nullable
- `forwarding_email_slug` varchar(80) required unique
- `created_at`, `updated_at` timestamptz required

### `users`

Application user linked to Supabase `auth.users`.

- `id` uuid primary key; same value as Supabase auth user id
- `account_id` uuid required
- `email` text required
- `role` text required, v1 constrained to `owner`
- `created_at` timestamptz required

### `vendors`

Tenant vendors/subcontractors whose COIs are tracked.

- `id` uuid primary key
- `account_id` uuid required
- `name` text required
- `contact_email` text nullable
- `trade` text nullable
- `status` enum `active | inactive`, default `active`
- `created_at`, `updated_at` timestamptz required

### `requirement_templates`

Per-account requirements used to match extracted coverage data. These rules track whether uploaded documents match requirements; they do not advise on adequacy.

- `id` uuid primary key
- `account_id` uuid required
- `name` text required
- `rules` jsonb required; shape: coverage type keys mapped to minimum limits and additional-insured requirement flags
- `expiring_soon_window_days` integer required default `30`
- `created_at`, `updated_at` timestamptz required

### `certificates`

Uploaded or emailed COI document record.

- `id` uuid primary key
- `account_id` uuid required
- `vendor_id` uuid required
- `storage_key` text required
- `source` enum `upload | email` required
- `status` enum `processing | needs_review | approved | rejected`, default `processing`
- `created_at`, `updated_at` timestamptz required

### `extractions`

Model output and deterministic normalized output for a certificate.

- `id` uuid primary key
- `account_id` uuid required
- `certificate_id` uuid required
- `raw_output` jsonb required
- `normalized` jsonb required
- `confidence` numeric required, 0 through 1
- `model` text required
- `created_at` timestamptz required

### `coverages`

Normalized coverage lines derived from validated extraction data.

- `id` uuid primary key
- `account_id` uuid required
- `certificate_id` uuid required
- `coverage_type` text required
- `insurer` text nullable
- `policy_number` text nullable
- `each_occurrence_limit` integer nullable
- `aggregate_limit` integer nullable
- `effective_date`, `expiry_date` date nullable
- `additional_insured` boolean required default false
- `created_at` timestamptz required

### `compliance_results`

Deterministic match result between normalized coverages and a requirement template.

- `id` uuid primary key
- `account_id` uuid required
- `certificate_id` uuid required
- `requirement_template_id` uuid required
- `status` compliance status enum required
- `reasons` jsonb required
- `evaluated_at` timestamptz required

### `review_tasks`

HITL review queue.

- `id` uuid primary key
- `account_id` uuid required
- `certificate_id` uuid required
- `reason` text required
- `status` enum `open | resolved | dismissed`, default `open`
- `resolution` jsonb nullable
- `resolved_at` timestamptz nullable
- `resolved_by` uuid nullable
- `created_at` timestamptz required

### `reminders`

Scheduled vendor emails for missing, expiring, or non-compliant COIs.

- `id` uuid primary key
- `account_id` uuid required
- `vendor_id` uuid required
- `certificate_id` uuid nullable
- `type` enum `expiry | missing | non-compliant` required
- `scheduled_for` timestamptz required
- `sent_at` timestamptz nullable
- `escalation_level` integer required default `1`
- `created_at` timestamptz required

### `audit_log`

Immutable append-only audit events. Update and delete must be blocked at the database layer.

- `id` uuid primary key
- `account_id` uuid required
- `actor_type` enum `user | system | webhook` required
- `actor_id` text nullable
- `action` text required
- `entity` text required
- `before` jsonb nullable
- `after` jsonb nullable
- `created_at` timestamptz required

### `subscriptions`

Stripe subscription mirror.

- `id` uuid primary key
- `account_id` uuid required
- `stripe_customer_id` text required
- `stripe_subscription_id` text required unique
- `plan` account plan enum required
- `status` enum `trialing | active | past_due | canceled | unpaid` required
- `trial_ends_at` timestamptz nullable
- `current_period_end` timestamptz nullable
- `created_at`, `updated_at` timestamptz required

### `jobs`

DB-backed queue for extraction and reminder work.

- `id` uuid primary key
- `type` text required
- `payload` jsonb required
- `status` enum `queued | running | succeeded | failed`, default `queued`
- `run_after` timestamptz required
- `attempts` integer required default `0`
- `locked_at` timestamptz nullable
- `created_at`, `updated_at` timestamptz required
