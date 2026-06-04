import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirementTemplates } from "@/db/schema";
import { db } from "@/lib/db/client";
import { enqueueJob } from "@/lib/jobs/queue";
import { getAuthenticatedAccount } from "../_lib/auth";
import { badRequest, unauthorized } from "../_lib/http";
import { rulesInputSchema } from "./_rules";
import { serializeRequirementTemplate } from "./_serialize";

const createRequirementSchema = z.object({
  name: z.string().trim().min(1),
  rules: rulesInputSchema,
  expiring_soon_window_days: z.number().int().positive().optional()
});

export async function GET(_request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const requirements = await db
    .select()
    .from(requirementTemplates)
    .where(eq(requirementTemplates.accountId, auth.accountId))
    .orderBy(desc(requirementTemplates.createdAt));

  return NextResponse.json({
    requirements: requirements.map(serializeRequirementTemplate)
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = createRequirementSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include name, supported coverage rules, and optional positive expiring_soon_window_days.");
  }

  const [requirement] = await db
    .insert(requirementTemplates)
    .values({
      accountId: auth.accountId,
      name: parsed.data.name,
      rules: parsed.data.rules,
      expiringSoonWindowDays: parsed.data.expiring_soon_window_days ?? 30
    })
    .returning();

  // Enqueue background job to evaluate all existing approved certs against the new template.
  // Fire-and-forget — the API returns immediately; compliance results appear after cron runs.
  await enqueueJob({
    type: "compliance",
    payload: {
      requirementTemplateId: requirement.id,
      accountId: auth.accountId,
    },
  });

  return NextResponse.json(
    { requirement: serializeRequirementTemplate(requirement) },
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
