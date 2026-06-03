import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { reviewTasks } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../_lib/auth";
import { badRequest, unauthorized } from "../_lib/http";
import { serializeReviewTask } from "./_serialize";

const REVIEW_STATUSES = new Set(["open", "resolved", "dismissed"]);

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const status = request.nextUrl.searchParams.get("status");

  if (status !== null && !REVIEW_STATUSES.has(status)) {
    return badRequest("status must be one of: open, resolved, dismissed.");
  }

  const filters = [eq(reviewTasks.accountId, auth.accountId)];
  if (status !== null) {
    filters.push(eq(reviewTasks.status, status as "open" | "resolved" | "dismissed"));
  }

  const reviews = await db
    .select()
    .from(reviewTasks)
    .where(and(...filters))
    .orderBy(desc(reviewTasks.createdAt));

  return NextResponse.json({
    reviews: reviews.map(serializeReviewTask)
  });
}
