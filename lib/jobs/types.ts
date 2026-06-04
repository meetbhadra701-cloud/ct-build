// Typed job payload definitions — these are stored as JSONB in the jobs table.

export interface ExtractionJobPayload {
  certificateId: string;
  accountId: string;
  storageKey: string;
  filename?: string;
}

export interface ReminderJobPayload {
  reminderId: string;
  accountId: string;
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
  accountName: string;
  certificateId?: string;
  type: "expiry" | "missing" | "non-compliant";
  escalationLevel: number;
  expiryDate?: string;
}

// Triggered when a requirement template is created or updated.
// Re-evaluates all approved certificates for the account against the template.
export interface ComplianceJobPayload {
  requirementTemplateId: string;
  accountId: string;
}

export type JobType = "extract" | "remind" | "compliance";
export type JobPayload =
  | ExtractionJobPayload
  | ReminderJobPayload
  | ComplianceJobPayload;
