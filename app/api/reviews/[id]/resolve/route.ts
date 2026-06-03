import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { reviewTasks } from "@/db/schema";
import { db } from "@/lib/db/client";
import { resolveReview } from "@/lib/hitl/resolver";
import { getAuthenticatedAccount } from "../../../_lib/auth";
import { apiError, badRequest, notFound, unauthorized } from "../../../_lib/http";
import { serializeReviewTask } from "../../_serialize";

const correctedCoverageSchema = z.object({
  coverage_type: z.enum([
    "general_liability",
    "auto",
    "umbrella",
    "workers_comp",
    "professional",
    "property",
    "other"
  ]),
  insurer: z.string().nullable().optional(),
  policy_number: z.string().nullable().optional(),
  each_occurrence_limit: z.number().int().nonnegative().nullable().optional(),
  aggregate_limit: z.number().int().nonnegative().nullable().optional(),
  effective_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  additional_insured: z.boolean().optional()
});

const resolveReviewSchema = z.object({
  resolution: z.object({
    decision: z.enum(["approve", "reject"]),
    corrected_coverages: z.array(correctedCoverageSchema).optional(),
    notes: z.string().optional()
  }),
  requirement_template_id: z.string().uuid().optional()
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
    return badRequest(
      "Body must include resolution.decision and optional corrected_coverages, notes, and requirement_template_id."
    );
  }

  const { id } = await context.params;
  try {
    await resolveReview({
      reviewTaskId: id,
      accountId: auth.accountId,
      resolvedByUserId: auth.userId,
      resolution: parsed.data.resolution,
      requirementTemplateId: parsed.data.requirement_template_id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve review task.";

    if (message.includes("not found")) {
      return notFound("Review task not found.");
    }

    if (message.includes("already")) {
      return apiError(409, "review_already_resolved", message);
    }

    throw error;
  }

  const [review] = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.id, id), eq(reviewTasks.accountId, auth.accountId)))
    .limit(1);

  if (!review) {
    return notFound("Review task not found.");
  }

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
