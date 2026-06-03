import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { vendors } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { badRequest, notFound, unauthorized } from "../../_lib/http";
import { serializeVendor } from "../_serialize";

const updateVendorSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    contact_email: z.string().email().nullable().optional(),
    trade: z.string().trim().nullable().optional(),
    status: z.enum(["active", "inactive"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required."
  });

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const { id } = await context.params;
  const vendor = await getVendor(id, auth.accountId);

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  return NextResponse.json({ vendor: serializeVendor(vendor) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = updateVendorSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include at least one valid vendor field.");
  }

  const { id } = await context.params;
  const [vendor] = await db
    .update(vendors)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.contact_email !== undefined
        ? { contactEmail: parsed.data.contact_email }
        : {}),
      ...(parsed.data.trade !== undefined ? { trade: parsed.data.trade } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      updatedAt: new Date()
    })
    .where(and(eq(vendors.id, id), eq(vendors.accountId, auth.accountId)))
    .returning();

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  return NextResponse.json({ vendor: serializeVendor(vendor) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const { id } = await context.params;
  const [vendor] = await db
    .update(vendors)
    .set({
      status: "inactive",
      updatedAt: new Date()
    })
    .where(and(eq(vendors.id, id), eq(vendors.accountId, auth.accountId)))
    .returning({ id: vendors.id });

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  return NextResponse.json({ deleted: true });
}

async function getVendor(id: string, accountId: string) {
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.accountId, accountId)))
    .limit(1);

  return vendor ?? null;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
