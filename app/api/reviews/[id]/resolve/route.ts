import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, reviewTasks } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../../_lib/auth";
import { badRequest, notFound, unauthorized } from "../../../_lib/http";
import { serializeReviewTask } from "../../_serialize";

const resolveReviewSchema = z.object({
  resolution: z.record(z.string(), z.unknown())
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = resolveReviewSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include a resolution object.");
  }

  const { id } = await context.params;
  const [existingReview] = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.id, id), eq(reviewTasks.accountId, auth.accountId)))
    .limit(1);

  if (!existingReview) {
    return notFound("Review task not found.");
  }

  const resolvedAt = new Date();
  const [review] = await db
    .update(reviewTasks)
    .set({
      status: "resolved",
      resolution: parsed.data.resolution,
      resolvedAt,
      resolvedBy: auth.userId
    })
    .where(and(eq(reviewTasks.id, id), eq(reviewTasks.accountId, auth.accountId)))
    .returning();

  await db.insert(auditLog).values({
    accountId: auth.accountId,
    actorType: "user",
    actorId: auth.userId,
    action: "review.resolved",
    entity: `review_task:${id}`,
    before: serializeReviewTask(existingReview),
    after: serializeReviewTask(review)
  });

  return NextResponse.json({
    review: serializeReviewTask(review)
  });
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
