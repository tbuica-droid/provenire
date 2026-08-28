import type { Deal, Finding } from "../types";
import { dealContext } from "../db/repo";
import {
  MEMO_SYSTEM_PROMPT,
  MEMO_DISCLAIMER,
  DEFAULT_MEMO_SECTIONS,
} from "./prompts";
import { callText } from "./client";

// Strip persistence/UI-only fields so the model sees exactly the Part A Finding
// shape it was specified to consume — no review_status, grounded flags, etc.
function toPromptFinding(f: Finding) {
  return {
    id: f.id,
    category: f.category,
    finding_type: f.finding_type,
    title: f.title,
    severity: f.severity,
    rationale: f.rationale,
    evidence: f.evidence,
    benchmark: f.benchmark,
    estimated_value_impact: f.estimated_value_impact,
    confidence: f.confidence,
  };
}

export async function assembleMemo(
  deal: Deal,
  approvedFindings: Finding[],
  sections: string[] = DEFAULT_MEMO_SECTIONS,
): Promise<string> {
  const payload = {
    deal_context: dealContext(deal),
    memo_section_order: sections,
    approved_findings: approvedFindings.map(toPromptFinding),
  };

  const user =
    "Assemble the Investment Committee memo per your system instructions, " +
    "using ONLY these approved findings.\n\n" +
    JSON.stringify(payload, null, 2);

  let memo = (await callText(MEMO_SYSTEM_PROMPT, user)).trim();

  // Hard backstop: the disclaimer is mandatory and verbatim. If the model ever
  // omits or alters it, prepend the exact line.
  if (!memo.startsWith(MEMO_DISCLAIMER)) {
    // Remove any near-duplicate the model may have produced before re-prepending.
    memo = memo.replace(/^DRAFT[^\n]*\n+/i, "").trim();
    memo = `${MEMO_DISCLAIMER}\n\n${memo}`;
  }
  return memo;
}
