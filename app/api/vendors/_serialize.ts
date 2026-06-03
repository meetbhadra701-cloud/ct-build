import type { vendors } from "@/db/schema";

export function serializeVendor(vendor: typeof vendors.$inferSelect) {
  return {
    id: vendor.id,
    account_id: vendor.accountId,
    name: vendor.name,
    contact_email: vendor.contactEmail,
    trade: vendor.trade,
    status: vendor.status,
    created_at: vendor.createdAt.toISOString(),
    updated_at: vendor.updatedAt.toISOString()
  };
}
