// Typed job payload definitions — these are stored as JSONB in the jobs table.

export interface ExtractionJobPayload {
  certificateId: string;
  accountId: string;
  storageKey: string;
  filename?: string;
  // If provided, the compliance engine runs immediately after extraction succeeds.
  requirementTemplateId?: string;
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

export type JobType = "extract" | "remind";
export type JobPayload = ExtractionJobPayload | ReminderJobPayload;
