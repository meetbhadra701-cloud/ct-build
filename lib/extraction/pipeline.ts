// Architect-owned: orchestrates ingest → Claude extract → deterministic validate →
// DB store → HITL routing. Codex never edits this file.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { downloadPDF } from "@/lib/storage/client";
import {
  auditLog,
  certificates,
  coverages as coveragesTable,
  extractions,
  reviewTasks,
} from "@/db/schema";
import { extractFromPDF } from "./extract";
import { validateAndNormalize } from "./validate";

export interface PipelineParams {
  certificateId: string;
  accountId: string;
  storageKey: string;
  filename?: string;
}

export interface PipelineResult {
  extractionId: string;
  finalConfidence: number;
  requiresHitl: boolean;
  hitlReason?: string;
  coverageCount: number;
}

// runExtractionPipeline runs the full extraction flow for one certificate.
// Callers: the extraction job processor (Phase 6) and the API upload handler.
export async function runExtractionPipeline(
  params: PipelineParams
): Promise<PipelineResult> {
  const {
    certificateId,
    accountId,
    storageKey,
    filename = "certificate.pdf",
  } = params;

  // 1. Download PDF from Supabase Storage (private bucket, service role).
  const pdfBuffer = await downloadPDF(storageKey);
  const pdfBase64 = pdfBuffer.toString("base64");

  // 2. Extract using Claude.
  //    Raw output is stored unmodified — never trust raw output alone.
  const rawOutput = await extractFromPDF(pdfBase64, filename);

  // 3. Deterministic validation and normalization.
  //    This is the layer that catches model errors before they reach the DB.
  const validation = validateAndNormalize(rawOutput);

  const model =
    process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-sonnet-4-6";

  // 4. Persist extraction record — raw AND normalized both stored.
  const [extraction] = await db
    .insert(extractions)
    .values({
      accountId,
      certificateId,
      rawOutput: rawOutput as unknown as Record<string, unknown>,
      normalized: validation.normalized as unknown as Record<string, unknown>,
      confidence: String(validation.final_confidence),
      model,
    })
    .returning({ id: extractions.id });

  // 5. Persist normalized coverage lines.
  if (validation.normalized.coverages.length > 0) {
    await db.insert(coveragesTable).values(
      validation.normalized.coverages.map((c) => ({
        accountId,
        certificateId,
        coverageType: c.coverage_type,
        insurer: c.insurer,
        policyNumber: c.policy_number,
        eachOccurrenceLimit: c.each_occurrence_limit,
        aggregateLimit: c.aggregate_limit,
        effectiveDate: c.effective_date,
        expiryDate: c.expiry_date,
        additionalInsured: c.additional_insured,
      }))
    );
  }

  // 6. HITL routing: low confidence or contradictions → human review queue.
  if (validation.requires_hitl) {
    await db.insert(reviewTasks).values({
      accountId,
      certificateId,
      reason: validation.hitl_reason ?? "Low extraction confidence",
      status: "open",
    });

    await db
      .update(certificates)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(certificates.id, certificateId));

    await db.insert(auditLog).values({
      accountId,
      actorType: "system",
      action: "extraction.needs_review",
      entity: `certificate:${certificateId}`,
      after: {
        confidence: validation.final_confidence,
        reason: validation.hitl_reason,
        issues: validation.issues,
      },
    });
  } else {
    // Extraction passed validation — mark certificate approved (extraction lifecycle done).
    // The compliance engine will write a compliance_result separately.
    await db
      .update(certificates)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(certificates.id, certificateId));

    await db.insert(auditLog).values({
      accountId,
      actorType: "system",
      action: "extraction.completed",
      entity: `certificate:${certificateId}`,
      after: {
        confidence: validation.final_confidence,
        coverage_count: validation.normalized.coverages.length,
        model,
      },
    });
  }

  return {
    extractionId: extraction.id,
    finalConfidence: validation.final_confidence,
    requiresHitl: validation.requires_hitl,
    hitlReason: validation.hitl_reason,
    coverageCount: validation.normalized.coverages.length,
  };
}
