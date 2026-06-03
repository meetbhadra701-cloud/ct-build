import { NextRequest, NextResponse } from "next/server";

import { processNextBatch } from "@/lib/jobs/processor";
import { apiError } from "../_lib/http";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret) {
    const providedSecret = request.headers.get("x-cron-secret");

    if (providedSecret !== expectedSecret) {
      return apiError(401, "unauthorized", "Invalid cron secret.");
    }
  }

  const processed = await processNextBatch();

  return NextResponse.json({ processed });
}
