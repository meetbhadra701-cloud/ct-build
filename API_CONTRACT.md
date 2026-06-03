# API_CONTRACT.md — Frozen v1

## Contract Status

- Status: **frozen v1**
- Frozen on: 2026-06-03
- Applies to Codex-owned route implementation under `/app/api/**`

## Global Rules

- All endpoints require an authenticated Supabase user unless explicitly marked webhook.
- Authenticated user lookup resolves `users.account_id`; that value is the only tenant scope for the request.
- Every tenant-scoped query must include `account_id = authenticatedAccountId`.
- Never accept `account_id` from client request bodies or query strings.
- Response bodies use JSON. Errors use `{ "error": { "code": string, "message": string } }`.
- `404` is returned when a row does not exist for the authenticated account, even if it exists in another account.
- The API tracks requirement matches. It must not say or imply that coverage is adequate.

## Vendors

### `GET /api/vendors`

- Auth: user
- Query: optional `status=active|inactive`
- Scope: `vendors.account_id = authenticatedAccountId`
- Response `200`: `{ "vendors": Vendor[] }`

### `POST /api/vendors`

- Auth: user
- Body: `{ "name": string, "contact_email"?: string, "trade"?: string, "status"?: "active" | "inactive" }`
- Scope: insert with `account_id = authenticatedAccountId`
- Response `201`: `{ "vendor": Vendor }`

### `GET /api/vendors/:id`

- Auth: user
- Scope: `vendors.id = id AND vendors.account_id = authenticatedAccountId`
- Response `200`: `{ "vendor": Vendor }`

### `PATCH /api/vendors/:id`

- Auth: user
- Body: partial `{ "name": string, "contact_email": string | null, "trade": string | null, "status": "active" | "inactive" }`
- Scope: update by `id` and `account_id`
- Response `200`: `{ "vendor": Vendor }`

### `DELETE /api/vendors/:id`

- Auth: user
- Scope: delete or deactivate by `id` and `account_id`
- Response `200`: `{ "deleted": true }`

## Certificates

### `POST /api/certificates/upload-url`

- Auth: user
- Body: `{ "vendor_id": string, "filename": string, "content_type": string }`
- Scope: verify `vendor_id` belongs to authenticated account
- Behavior: create a tenant-scoped storage key and signed upload URL
- Response `201`: `{ "storage_key": string, "upload_url": string }`

### `POST /api/certificates`

- Auth: user
- Body: `{ "vendor_id": string, "storage_key": string, "source": "upload" | "email" }`
- Scope: verify `vendor_id` belongs to authenticated account; insert with authenticated account
- Behavior: creates `certificates.status = processing` and queues extraction job
- Response `201`: `{ "certificate": Certificate }`

### `GET /api/certificates`

- Auth: user
- Query: optional `vendor_id`, optional `status`
- Scope: `certificates.account_id = authenticatedAccountId`
- Response `200`: `{ "certificates": Certificate[] }`

### `GET /api/certificates/:id`

- Auth: user
- Scope: `certificates.id = id AND certificates.account_id = authenticatedAccountId`
- Response `200`: `{ "certificate": Certificate, "coverages": Coverage[], "latest_compliance_result": ComplianceResult | null }`

## Requirement Templates

### `GET /api/requirements`

- Auth: user
- Scope: `requirement_templates.account_id = authenticatedAccountId`
- Response `200`: `{ "requirements": RequirementTemplate[] }`

### `POST /api/requirements`

- Auth: user
- Body: `{ "name": string, "rules": object, "expiring_soon_window_days"?: number }`
- Scope: insert with authenticated account
- Response `201`: `{ "requirement": RequirementTemplate }`

### `PATCH /api/requirements/:id`

- Auth: user
- Body: partial `{ "name": string, "rules": object, "expiring_soon_window_days": number }`
- Scope: update by `id` and `account_id`
- Response `200`: `{ "requirement": RequirementTemplate }`

## Compliance

### `GET /api/compliance/rollup`

- Auth: user
- Scope: all joins filter by authenticated account
- Response `200`: `{ "counts": { "compliant": number, "expiring-soon": number, "expired": number, "non-compliant": number }, "generated_at": string }`

### `GET /api/compliance/certificates/:certificate_id`

- Auth: user
- Scope: `certificate_id` and every joined table must match authenticated account
- Response `200`: `{ "result": ComplianceResult | null }`

## HITL Reviews

### `GET /api/reviews`

- Auth: user
- Query: optional `status=open|resolved|dismissed`
- Scope: `review_tasks.account_id = authenticatedAccountId`
- Response `200`: `{ "reviews": ReviewTask[] }`

### `POST /api/reviews/:id/resolve`

- Auth: user
- Body: `{ "resolution": object }`
- Scope: update by `id` and `account_id`; `resolved_by` is authenticated user id
- Response `200`: `{ "review": ReviewTask }`

## Reminders

### `GET /api/reminders`

- Auth: user
- Query: optional `sent=true|false`
- Scope: `reminders.account_id = authenticatedAccountId`
- Response `200`: `{ "reminders": Reminder[] }`

### `POST /api/reminders`

- Auth: user
- Body: `{ "vendor_id": string, "certificate_id"?: string, "type": "expiry" | "missing" | "non-compliant", "scheduled_for": string, "escalation_level"?: number }`
- Scope: verify vendor and certificate belong to authenticated account
- Response `201`: `{ "reminder": Reminder }`

## Stripe

### `POST /api/stripe/checkout`

- Auth: user
- Body: `{ "plan": "starter" | "growth" }`
- Scope: account derived from authenticated user
- Response `201`: `{ "url": string }`

### `POST /api/stripe/portal`

- Auth: user
- Body: none
- Scope: account derived from authenticated user
- Response `201`: `{ "url": string }`

### `POST /api/webhooks/stripe`

- Auth: Stripe signature verification, not user auth
- Required: verify webhook signature before reading event semantics
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Scope: resolve account by stored Stripe customer/subscription id before updates
- Response `200`: `{ "received": true }`

## Inbound Email

### `POST /api/webhooks/inbound-email`

- Auth: provider webhook verification to be defined by selected inbound email provider
- Body: provider-specific payload including forwarding recipient/slug and attachment metadata
- Scope: resolve `accounts.forwarding_email_slug`; all created records use that account id
- Behavior: create certificate from attachment metadata and queue extraction
- Response `202`: `{ "accepted": true }`

## Shared Types

`Vendor`, `Certificate`, `Coverage`, `RequirementTemplate`, `ComplianceResult`, `ReviewTask`, and `Reminder` mirror the frozen v1 fields in `SCHEMA.md`, using snake_case JSON keys.
