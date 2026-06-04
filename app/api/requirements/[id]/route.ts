import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirementTemplates } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { badRequest, notFound, unauthorized } from "../../_lib/http";
import { rulesInputSchema } from "../_rules";
import { serializeRequirementTemplate } from "../_serialize";

const updateRequirementSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    rules: rulesInputSchema.optional(),
    expiring_soon_window_days: z.number().int().positive().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required."
  });

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = updateRequirementSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include at least one valid requirement field.");
  }

  const { id } = await context.params;
  const [requirement] = await db
    .update(requirementTemplates)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.rules !== undefined ? { rules: parsed.data.rules } : {}),
      ...(parsed.data.expiring_soon_window_days !== undefined
        ? { expiringSoonWindowDays: parsed.data.expiring_soon_window_days }
        : {}),
      updatedAt: new Date()
    })
    .where(and(eq(requirementTemplates.id, id), eq(requirementTemplates.accountId, auth.accountId)))
    .returning();

  if (!requirement) {
    return notFound("Requirement template not found.");
  }

  return NextResponse.json({ requirement: serializeRequirementTemplate(requirement) });
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
