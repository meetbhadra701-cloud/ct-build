import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { certificates, extractions, reviewTasks } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { notFound, unauthorized } from "../../_lib/http";
import { serializeCertificate } from "../../certificates/_serialize";
import { serializeReviewTask } from "../_serialize";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();
  if (!auth) return unauthorized();

  const { id } = await context.params;
  const [review] = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.id, id), eq(reviewTasks.accountId, auth.accountId)))
    .limit(1);

  if (!review) return notFound("Review task not found.");

  const [certificate] = await db
    .select()
    .from(certificates)
    .where(
      and(
        eq(certificates.id, review.certificateId),
        eq(certificates.accountId, auth.accountId)
      )
    )
    .limit(1);

  const [latestExtraction] = await db
    .select({
      rawOutput: extractions.rawOutput,
      normalized: extractions.normalized,
      confidence: extractions.confidence,
      createdAt: extractions.createdAt
    })
    .from(extractions)
    .where(
      and(
        eq(extractions.certificateId, review.certificateId),
        eq(extractions.accountId, auth.accountId)
      )
    )
    .orderBy(desc(extractions.createdAt))
    .limit(1);

  return NextResponse.json({
    review: serializeReviewTask(review),
    certificate: certificate ? serializeCertificate(certificate) : null,
    extraction: latestExtraction
      ? {
          raw_output: latestExtraction.rawOutput,
          normalized: latestExtraction.normalized,
          confidence: latestExtraction.confidence,
          created_at: latestExtraction.createdAt.toISOString()
        }
      : null
  });
}
