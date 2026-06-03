import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { vendors } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../_lib/auth";
import { badRequest, unauthorized } from "../_lib/http";
import { serializeVendor } from "./_serialize";

const vendorStatuses = new Set(["active", "inactive"]);

const createVendorSchema = z.object({
  name: z.string().trim().min(1),
  contact_email: z.string().email().nullable().optional(),
  trade: z.string().trim().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const status = request.nextUrl.searchParams.get("status");

  if (status !== null && !vendorStatuses.has(status)) {
    return badRequest("status must be one of: active, inactive.");
  }

  const filters = [eq(vendors.accountId, auth.accountId)];
  if (status !== null) {
    filters.push(eq(vendors.status, status as "active" | "inactive"));
  }

  const rows = await db
    .select()
    .from(vendors)
    .where(and(...filters))
    .orderBy(desc(vendors.createdAt));

  return NextResponse.json({
    vendors: rows.map(serializeVendor)
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = createVendorSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include a non-empty name and valid optional vendor fields.");
  }

  const [vendor] = await db
    .insert(vendors)
    .values({
      accountId: auth.accountId,
      name: parsed.data.name,
      contactEmail: parsed.data.contact_email ?? null,
      trade: parsed.data.trade ?? null,
      status: parsed.data.status ?? "active"
    })
    .returning();

  return NextResponse.json({ vendor: serializeVendor(vendor) }, { status: 201 });
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
