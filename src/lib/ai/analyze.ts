import { randomUUID } from "node:crypto";
import { CATEGORIES, type Category, type Deal, type RawFinding } from "../types";
import { dealContext } from "../db/repo";
import { retrieveForCategory, type RetrievedChunk } from "../retrieval/retriever";
import { FINDINGS_SYSTEM_PROMPT } from "./prompts";
import { FINDINGS_SCHEMA } from "./schema";
import { callForJson } from "./client";

export interface AnalyzeResult {
  runId: string;
  findings: (RawFinding & { grounded: boolean })[];
  perCategory: Record<Category, { retrieved: number; findings: number }>;
  ungrounded: number;
}

const RETRIEVAL_K = () => {
  const n = parseInt(process.env.PROVENIRE_RETRIEVAL_K ?? "14", 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Defensive JSON-array extraction: handles the model returning a bare array,
// fenced markdown, or an object wrapping the array.
function parseFindingsJson(raw: string): any[] {
  const tryParse = (s: string): any[] | null => {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.findings)) return v.findings;
      return null;
    } catch {
      return null;
    }
  };

  let v = tryParse(raw.trim());
  if (v) return v;

  // Strip ```json fences if present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    v = tryParse(fence[1].trim());
    if (v) return v;
  }

  // Last resort: slice from first '[' to last ']'.
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start >= 0 && end > start) {
    v = tryParse(raw.slice(start, end + 1));
    if (v) return v;
  }
  return [];
}

// Build the Part C invocation payload for one (category, deal) call.
function buildUserPayload(
  deal: Deal,
  category: Category,
  chunks: RetrievedChunk[],
): string {
  const payload = {
    deal_context: dealContext(deal),
    category,
    retrieved_chunks: chunks.map((c) => ({
      source_doc: c.source_doc,
      location: c.location,
      text: c.text,
    })),
  };
  return (
    "Analyze the following per your system instructions. " +
    "Use ONLY the retrieved_chunks below as citable evidence.\n\n" +
    JSON.stringify(payload, null, 2)
  );
}

// Citation-enforcement: every finding must cite a document actually supplied to
// this call. Evidence pointing at unsupplied docs is dropped; a finding left with
// no grounded evidence is coerced to an Open Question (per Part A's contract) and
// flagged needs_human_review — the model is never allowed to fabricate its way
// into the dashboard.
function enforceGrounding(
  parsed: any[],
  category: Category,
  suppliedDocs: Set<string>,
  seenIds: Set<string>,
): (RawFinding & { grounded: boolean })[] {
  const out: (RawFinding & { grounded: boolean })[] = [];

  for (const f of parsed) {
    if (!f || typeof f !== "object") continue;

    const evidenceIn = Array.isArray(f.evidence) ? f.evidence : [];
    const grounded = evidenceIn.filter(
      (e: any) => e && suppliedDocs.has(norm(String(e.source_doc ?? ""))),
    );
    const ungroundedClaims = evidenceIn.length - grounded.length;

    const isGrounded = grounded.length > 0;

    // Build a unique id (namespaced per category; de-dupe across calls).
    let id = String(f.id ?? "").trim() || `${category.toLowerCase()}-finding`;
    id = `${category.toLowerCase().slice(0, 3)}-${id}`.replace(/[^a-z0-9\-]/gi, "-");
    let unique = id;
    let n = 2;
    while (seenIds.has(unique)) unique = `${id}-${n++}`;
    seenIds.add(unique);

    let finding_type = f.finding_type;
    let severity = f.severity ?? null;
    let confidence = f.confidence ?? "Low";
    let needs_human_review = !!f.needs_human_review;
    let rationale = String(f.rationale ?? "").trim();
    let evidence = grounded.map((e: any) => ({
      source_doc: String(e.source_doc ?? ""),
      location: String(e.location ?? ""),
      quote_or_value: String(e.quote_or_value ?? ""),
    }));

    if (!isGrounded) {
      // Backstop enforcement of the grounding contract.
      finding_type = "Open Question";
      severity = null;
      confidence = "Low";
      needs_human_review = true;
      rationale =
        "[UNVERIFIED CITATION — grounding backstop] The model's cited source was not among the documents retrieved for this category, so this is surfaced as an Open Question rather than a fact. " +
        rationale;
      // Preserve what the model *claimed* (clearly marked) for the reviewer.
      evidence = evidenceIn.slice(0, 1).map((e: any) => ({
        source_doc: `UNVERIFIED: ${String(e?.source_doc ?? "n/a")}`,
        location: String(e?.location ?? "n/a"),
        quote_or_value: String(e?.quote_or_value ?? ""),
      }));
    } else if (ungroundedClaims > 0) {
      needs_human_review = true;
    }

    // Confidence Medium/Low always forces review (per Part A schema guidance).
    if (confidence === "Medium" || confidence === "Low") needs_human_review = true;

    out.push({
      id: unique,
      category, // force to the call's category for DB consistency
      finding_type,
      title: String(f.title ?? "Untitled finding").slice(0, 200),
      severity,
      rationale,
      evidence,
      benchmark: f.benchmark ?? null,
      estimated_value_impact: f.estimated_value_impact ?? null,
      confidence,
      needs_human_review,
      grounded: isGrounded,
    });
  }
  return out;
}

export async function analyzeDeal(deal: Deal): Promise<AnalyzeResult> {
  const runId = randomUUID();
  const k = RETRIEVAL_K();
  const all: (RawFinding & { grounded: boolean })[] = [];
  const seenIds = new Set<string>();
  const perCategory = {} as AnalyzeResult["perCategory"];

  for (const category of CATEGORIES) {
    const chunks = await retrieveForCategory(deal.id, category, k);

    if (chunks.length === 0) {
      // No relevant documents retrieved — emit an explicit Open Question rather
      // than calling the model with nothing to cite.
      const id = `${category.toLowerCase().slice(0, 3)}-no-evidence`;
      seenIds.add(id);
      all.push({
        id,
        category,
        finding_type: "Open Question",
        title: `No ${category.toLowerCase()} documents retrieved for analysis`,
        severity: null,
        rationale: `Retrieval surfaced no chunks relevant to the ${category} checklist for this deal. Upload ${category.toLowerCase()} source documents (e.g. ${category === "Operational" ? "an org chart / HRIS export" : category === "Financial" ? "financial statements / QoE" : category === "Legal" ? "material contracts / cap table" : "customer and pipeline data"}) to enable this category.`,
        evidence: [],
        benchmark: null,
        estimated_value_impact: null,
        confidence: "Low",
        needs_human_review: true,
        grounded: false,
      });
      perCategory[category] = { retrieved: 0, findings: 1 };
      continue;
    }

    const suppliedDocs = new Set(chunks.map((c) => norm(c.source_doc)));
    const user = buildUserPayload(deal, category, chunks);
    const raw = await callForJson(FINDINGS_SYSTEM_PROMPT, user, FINDINGS_SCHEMA);
    const parsed = parseFindingsJson(raw);
    const findings = enforceGrounding(parsed, category, suppliedDocs, seenIds);

    all.push(...findings);
    perCategory[category] = { retrieved: chunks.length, findings: findings.length };
  }

  return {
    runId,
    findings: all,
    perCategory,
    ungrounded: all.filter((f) => !f.grounded).length,
  };
}
