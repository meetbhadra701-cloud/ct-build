import { NextRequest, NextResponse } from "next/server";

import { processNextBatch } from "@/lib/jobs/processor";
import { apiError } from "../_lib/http";

// Vercel Cron invokes GET with `Authorization: Bearer <CRON_SECRET>`.
// Manual / internal callers use POST with `x-cron-secret: <CRON_SECRET>`.
// Both paths run the same job batch processor.

function isAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return true; // no secret configured → open (dev only)

  // Vercel Cron header
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expectedSecret}`) return true;

  // Legacy manual header (internal use / local testing)
  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === expectedSecret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(401, "unauthorized", "Invalid cron secret.");
  }
  const processed = await processNextBatch();
  return NextResponse.json({ processed });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(401, "unauthorized", "Invalid cron secret.");
  }
  const processed = await processNextBatch();
  return NextResponse.json({ processed });
}
