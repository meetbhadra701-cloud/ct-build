import type { reminders } from "@/db/schema";

export function serializeReminder(reminder: typeof reminders.$inferSelect) {
  return {
    id: reminder.id,
    account_id: reminder.accountId,
    vendor_id: reminder.vendorId,
    certificate_id: reminder.certificateId,
    type: reminder.type,
    scheduled_for: reminder.scheduledFor.toISOString(),
    sent_at: reminder.sentAt?.toISOString() ?? null,
    escalation_level: reminder.escalationLevel,
    created_at: reminder.createdAt.toISOString()
  };
}
