// Vendor reminder email sender.
// TODO: replace console.log with a real email provider (Resend, SendGrid, Postmark).
// The interface below is stable — swap the implementation without changing callers.

export interface VendorReminderEmailParams {
  to: string;
  vendorName: string;
  accountName: string; // the property manager's name
  type: "expiry" | "missing" | "non-compliant";
  escalationLevel: number;
  expiryDate?: string;
}

export async function sendVendorReminderEmail(
  params: VendorReminderEmailParams
): Promise<void> {
  const { to, vendorName, accountName, type, escalationLevel, expiryDate } = params;

  const subject =
    type === "expiry"
      ? `Action required: certificate of insurance expiring${expiryDate ? ` ${expiryDate}` : " soon"}`
      : type === "non-compliant"
        ? "Action required: certificate of insurance does not meet requirements"
        : "Action required: certificate of insurance on file is missing";

  const body =
    `Hi ${vendorName},\n\n` +
    (type === "expiry"
      ? `Your certificate of insurance on file with ${accountName} is expiring${expiryDate ? ` on ${expiryDate}` : " soon"}. ` +
        `Please provide an updated ACORD 25 certificate naming ${accountName} as additional insured.\n`
      : `Your certificate of insurance on file with ${accountName} requires attention. ` +
        `Please contact ${accountName} to resolve.\n`) +
    `\nThis is reminder notice #${escalationLevel}.\n`;

  // TODO: replace with real provider
  console.log(
    `[EMAIL] to=${to} subject="${subject}" escalation=${escalationLevel}\n${body}`
  );
}
