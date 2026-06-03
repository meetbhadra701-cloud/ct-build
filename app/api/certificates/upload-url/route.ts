import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { vendors } from "@/db/schema";
import { db } from "@/lib/db/client";
import { createUploadUrl } from "@/lib/storage/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { badRequest, notFound, unauthorized } from "../../_lib/http";

const uploadUrlSchema = z.object({
  vendor_id: z.string().uuid(),
  filename: z.string().trim().min(1),
  content_type: z.string().trim().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = uploadUrlSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include vendor_id, filename, and content_type.");
  }

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.id, parsed.data.vendor_id), eq(vendors.accountId, auth.accountId)))
    .limit(1);

  if (!vendor) {
    return notFound("Vendor not found.");
  }

  const upload = await createUploadUrl({
    accountId: auth.accountId,
    filename: parsed.data.filename,
    contentType: parsed.data.content_type
  });

  return NextResponse.json(
    {
      storage_key: upload.storageKey,
      upload_url: upload.uploadUrl
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
