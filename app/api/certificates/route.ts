import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { certificates, vendors } from "@/db/schema";
import { db } from "@/lib/db/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { getAuthenticatedAccount } from "../_lib/auth";
import { badRequest, notFound, unauthorized } from "../_lib/http";
import { serializeCertificate } from "./_serialize";

const certificateStatuses = new Set(["processing", "needs_review", "approved", "rejected"]);

const createCertificateSchema = z.object({
  vendor_id: z.string().uuid(),
  storage_key: z.string().trim().min(1),
  source: z.enum(["upload", "email"])
});

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const vendorId = request.nextUrl.searchParams.get("vendor_id");
  const status = request.nextUrl.searchParams.get("status");

  if (status !== null && !certificateStatuses.has(status)) {
    return badRequest("status must be one of: processing, needs_review, approved, rejected.");
  }

  const filters = [eq(certificates.accountId, auth.accountId)];
  if (vendorId !== null) {
    filters.push(eq(certificates.vendorId, vendorId));
  }
  if (status !== null) {
    filters.push(
      eq(certificates.status, status as "processing" | "needs_review" | "approved" | "rejected")
    );
  }

  const rows = await db
    .select()
    .from(certificates)
    .where(and(...filters))
    .orderBy(desc(certificates.createdAt));

  return NextResponse.json({
    certificates: rows.map(serializeCertificate)
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = createCertificateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include vendor_id, storage_key, and source.");
  }

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.id, parsed.data.vendor_id), eq(vendors.accountId, auth.accountId)))
    .limit(1);

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  const [certificate] = await db
    .insert(certificates)
    .values({
      accountId: auth.accountId,
      vendorId: parsed.data.vendor_id,
      storageKey: parsed.data.storage_key,
      source: parsed.data.source,
      status: "processing"
    })
    .returning();

  await enqueueJob({
    type: "extract",
    payload: {
      certificateId: certificate.id,
      accountId: auth.accountId,
      storageKey: certificate.storageKey
    }
  });

  return NextResponse.json(
    {
      certificate: serializeCertificate(certificate)
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
