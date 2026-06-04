import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send vendor reminder emails.");
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export interface VendorReminderEmailParams {
  to: string;
  vendorName: string;
  accountName: string; // the property manager's company name
  type: "expiry" | "missing" | "non-compliant";
  escalationLevel: number;
  expiryDate?: string;
}

export async function sendVendorReminderEmail(
  params: VendorReminderEmailParams
): Promise<void> {
  const { to, vendorName, accountName, type, escalationLevel, expiryDate } =
    params;
  const safeVendorName = escapeHtml(vendorName);
  const safeAccountName = escapeHtml(accountName);
  const safeBodyText = escapeHtml(
    type === "expiry"
      ? `Your certificate of insurance on file with ${accountName} is expiring${expiryDate ? ` on ${expiryDate}` : " soon"}. ` +
          `Please provide an updated ACORD 25 certificate naming ${accountName} as additional insured.`
      : `Your certificate of insurance on file with ${accountName} requires attention. ` +
          `Please contact ${accountName} to resolve.`
  );

  const subject =
    type === "expiry"
      ? `Action required: certificate of insurance expiring${expiryDate ? ` ${expiryDate}` : " soon"}`
      : type === "non-compliant"
        ? "Action required: certificate of insurance does not meet requirements"
        : "Action required: certificate of insurance on file is missing";

  const bodyText =
    type === "expiry"
      ? `Your certificate of insurance on file with ${accountName} is expiring${expiryDate ? ` on ${expiryDate}` : " soon"}. ` +
        `Please provide an updated ACORD 25 certificate naming ${accountName} as additional insured.`
      : `Your certificate of insurance on file with ${accountName} requires attention. ` +
        `Please contact ${accountName} to resolve.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <p>Hi ${safeVendorName},</p>
  <p>${safeBodyText}</p>
  <p style="color:#666;font-size:14px">This is reminder notice #${escalationLevel}.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="color:#999;font-size:12px">
    This email was sent by ${safeAccountName} via their certificate of insurance tracking system.
    It does not constitute legal or insurance advice.
  </p>
</body>
</html>`;

  const text =
    `Hi ${vendorName},\n\n${bodyText}\n\n` +
    `This is reminder notice #${escalationLevel}.\n\n` +
    `---\nSent by ${accountName} via their COI tracking system.`;

  const { error } = await getResendClient().emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend email failed: ${(error as { message?: string }).message ?? JSON.stringify(error)}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
