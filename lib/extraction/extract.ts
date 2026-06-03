import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { EXTRACTION_TOOL, SYSTEM_PROMPT } from "./prompt";
import type { RawExtractionOutput } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Calls Claude with the PDF and returns raw (unvalidated) extraction data.
// The deterministic validation layer in validate.ts runs after this.
export async function extractFromPDF(
  pdfBase64: string,
  filename: string
): Promise<RawExtractionOutput> {
  const model =
    process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-sonnet-4-6";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL as unknown as Tool],
    // force a single tool call — no fallback to text
    tool_choice: { type: "tool", name: "extract_coi_data" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Extract all insurance coverage data from this ACORD 25 Certificate of Insurance. File: ${filename}`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Extraction model did not return structured data (stop_reason: ${response.stop_reason})`
    );
  }

  return toolUse.input as RawExtractionOutput;
}
