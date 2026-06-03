import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountPlanEnum = pgEnum("account_plan", ["trial", "starter", "growth"]);
export const vendorStatusEnum = pgEnum("vendor_status", ["active", "inactive"]);
export const certificateSourceEnum = pgEnum("certificate_source", ["upload", "email"]);
export const certificateStatusEnum = pgEnum("certificate_status", [
  "processing",
  "needs_review",
  "approved",
  "rejected"
]);
export const complianceStatusEnum = pgEnum("compliance_status", [
  "compliant",
  "expiring-soon",
  "expired",
  "non-compliant"
]);
export const reviewStatusEnum = pgEnum("review_status", ["open", "resolved", "dismissed"]);
export const reminderTypeEnum = pgEnum("reminder_type", ["expiry", "missing", "non-compliant"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid"
]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);
export const actorTypeEnum = pgEnum("actor_type", ["user", "system", "webhook"]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    plan: accountPlanEnum("plan").notNull().default("trial"),
    stripeCustomerId: text("stripe_customer_id"),
    forwardingEmailSlug: varchar("forwarding_email_slug", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    forwardingEmailSlugUnique: uniqueIndex("accounts_forwarding_email_slug_unique").on(
      table.forwardingEmailSlug
    )
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("users_account_id_idx").on(table.accountId),
    accountRoleCheck: check("users_role_owner_check", sql`${table.role} = 'owner'`)
  })
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    name: text("name").notNull(),
    contactEmail: text("contact_email"),
    trade: text("trade"),
    status: vendorStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("vendors_account_id_idx").on(table.accountId)
  })
);

export const requirementTemplates = pgTable(
  "requirement_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    name: text("name").notNull(),
    rules: jsonb("rules").notNull(),
    expiringSoonWindowDays: integer("expiring_soon_window_days").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("requirement_templates_account_id_idx").on(table.accountId),
    expiringSoonPositive: check(
      "requirement_templates_expiring_window_positive",
      sql`${table.expiringSoonWindowDays} > 0`
    )
  })
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    storageKey: text("storage_key").notNull(),
    source: certificateSourceEnum("source").notNull(),
    status: certificateStatusEnum("status").notNull().default("processing"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("certificates_account_id_idx").on(table.accountId),
    vendorIdx: index("certificates_vendor_id_idx").on(table.vendorId)
  })
);

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
    rawOutput: jsonb("raw_output").notNull(),
    normalized: jsonb("normalized").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("extractions_account_id_idx").on(table.accountId),
    certificateIdx: index("extractions_certificate_id_idx").on(table.certificateId),
    confidenceRange: check(
      "extractions_confidence_range",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`
    )
  })
);

export const coverages = pgTable(
  "coverages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
    coverageType: text("coverage_type").notNull(),
    insurer: text("insurer"),
    policyNumber: text("policy_number"),
    eachOccurrenceLimit: integer("each_occurrence_limit"),
    aggregateLimit: integer("aggregate_limit"),
    effectiveDate: date("effective_date"),
    expiryDate: date("expiry_date"),
    additionalInsured: boolean("additional_insured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("coverages_account_id_idx").on(table.accountId),
    certificateIdx: index("coverages_certificate_id_idx").on(table.certificateId)
  })
);

export const complianceResults = pgTable(
  "compliance_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
    requirementTemplateId: uuid("requirement_template_id")
      .notNull()
      .references(() => requirementTemplates.id),
    status: complianceStatusEnum("status").notNull(),
    reasons: jsonb("reasons").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("compliance_results_account_id_idx").on(table.accountId),
    certificateIdx: index("compliance_results_certificate_id_idx").on(table.certificateId)
  })
);

export const reviewTasks = pgTable(
  "review_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
    reason: text("reason").notNull(),
    status: reviewStatusEnum("status").notNull().default("open"),
    resolution: jsonb("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("review_tasks_account_id_idx").on(table.accountId),
    certificateIdx: index("review_tasks_certificate_id_idx").on(table.certificateId)
  })
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    certificateId: uuid("certificate_id").references(() => certificates.id),
    type: reminderTypeEnum("type").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    escalationLevel: integer("escalation_level").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("reminders_account_id_idx").on(table.accountId),
    scheduledIdx: index("reminders_scheduled_for_idx").on(table.scheduledFor),
    escalationPositive: check("reminders_escalation_positive", sql`${table.escalationLevel} > 0`)
  })
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("audit_log_account_id_idx").on(table.accountId),
    createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt)
  })
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    plan: accountPlanEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("subscriptions_account_id_idx").on(table.accountId),
    stripeSubscriptionUnique: uniqueIndex("subscriptions_stripe_subscription_id_unique").on(
      table.stripeSubscriptionId
    )
  })
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusRunAfterIdx: index("jobs_status_run_after_idx").on(table.status, table.runAfter),
    attemptsNonNegative: check("jobs_attempts_non_negative", sql`${table.attempts} >= 0`)
  })
);
