import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { certificates, reminders, vendors } from "@/db/schema";
import { db } from "@/lib/db/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { getAuthenticatedAccount } from "../_lib/auth";
import { badRequest, notFound, unauthorized } from "../_lib/http";
import { serializeReminder } from "./_serialize";

const createReminderSchema = z.object({
  vendor_id: z.string().uuid(),
  certificate_id: z.string().uuid().optional(),
  type: z.enum(["expiry", "missing", "non-compliant"]),
  scheduled_for: z.string().datetime(),
  escalation_level: z.number().int().positive().optional()
});

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const sent = request.nextUrl.searchParams.get("sent");

  if (sent !== null && sent !== "true" && sent !== "false") {
    return badRequest("sent must be true or false.");
  }

  const filters = [eq(reminders.accountId, auth.accountId)];
  if (sent === "true") {
    filters.push(isNotNull(reminders.sentAt));
  }
  if (sent === "false") {
    filters.push(isNull(reminders.sentAt));
  }

  const rows = await db
    .select()
    .from(reminders)
    .where(and(...filters))
    .orderBy(desc(reminders.scheduledFor));

  return NextResponse.json({
    reminders: rows.map(serializeReminder)
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = createReminderSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(
      "Body must include vendor_id, type, scheduled_for ISO datetime, and optional certificate_id/escalation_level."
    );
  }

  const [vendor] = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      contactEmail: vendors.contactEmail
    })
    .from(vendors)
    .where(and(eq(vendors.id, parsed.data.vendor_id), eq(vendors.accountId, auth.accountId)))
    .limit(1);

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  if (parsed.data.certificate_id) {
    const [certificate] = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(
        and(
          eq(certificates.id, parsed.data.certificate_id),
          eq(certificates.accountId, auth.accountId)
        )
      )
      .limit(1);

    if (!certificate) {
      return notFound("Certificate not found.");
    }
  }

  const scheduledFor = new Date(parsed.data.scheduled_for);
  const [reminder] = await db
    .insert(reminders)
    .values({
      accountId: auth.accountId,
      vendorId: parsed.data.vendor_id,
      certificateId: parsed.data.certificate_id ?? null,
      type: parsed.data.type,
      scheduledFor,
      escalationLevel: parsed.data.escalation_level ?? 1
    })
    .returning();

  if (vendor.contactEmail) {
    await enqueueJob({
      type: "remind",
      payload: {
        reminderId: reminder.id,
        accountId: auth.accountId,
        vendorId: vendor.id,
        vendorEmail: vendor.contactEmail,
        vendorName: vendor.name,
        accountName: "Your property manager",
        certificateId: reminder.certificateId ?? undefined,
        type: reminder.type,
        escalationLevel: reminder.escalationLevel
      },
      runAfter: scheduledFor
    });
  }

  return NextResponse.json(
    {
      reminder: serializeReminder(reminder)
    },
    { status: 201 }
  );
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
