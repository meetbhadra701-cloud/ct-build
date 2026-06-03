import type { requirementTemplates } from "@/db/schema";

export function serializeRequirementTemplate(template: typeof requirementTemplates.$inferSelect) {
  return {
    id: template.id,
    account_id: template.accountId,
    name: template.name,
    rules: template.rules,
    expiring_soon_window_days: template.expiringSoonWindowDays,
    created_at: template.createdAt.toISOString(),
    updated_at: template.updatedAt.toISOString()
  };
}
