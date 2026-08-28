// Shared domain types for Provenire (provenire).
// These mirror the Finding schema specified in Part A of the analysis prompts,
// plus the persistence/review fields the app layers on top.

export type Category = "Financial" | "Legal" | "Commercial" | "Operational";
export const CATEGORIES: Category[] = [
  "Financial",
  "Legal",
  "Commercial",
  "Operational",
];

export type FindingType = "Risk" | "Opportunity" | "Open Question";
export type Severity = "High" | "Medium" | "Low" | null;
export type Confidence = "High" | "Medium" | "Low";

// Human review gate states. Findings begin as "pending" and only "approved"
// findings are ever passed to the memo-assembly prompt (Part B).
export type ReviewStatus = "pending" | "approved" | "rejected" | "edited";

export interface Evidence {
  source_doc: string; // exact filename / doc title as supplied in a retrieved chunk
  location: string; // page / section / clause / tab as supplied
  quote_or_value: string; // short verbatim snippet or figure
}

export interface Benchmark {
  metric: string;
  target_value: string;
  peer_benchmark_range: string;
  deviation: string;
  benchmark_source_note: string;
}

// The raw object the model is asked to emit (Part A schema).
export interface RawFinding {
  id: string;
  category: Category;
  finding_type: FindingType;
  title: string;
  severity: Severity;
  rationale: string;
  evidence: Evidence[];
  benchmark: Benchmark | null;
  estimated_value_impact: string | null;
  confidence: Confidence;
  needs_human_review: boolean;
}

// A finding as stored/served, with persistence + review + grounding metadata.
export interface Finding extends RawFinding {
  deal_id: string;
  run_id: string;
  review_status: ReviewStatus;
  // grounded === false means the citation-enforcement layer could not match any
  // of the finding's evidence to a chunk that was actually supplied to the model.
  grounded: boolean;
  created_at: string;
  reviewed_at: string | null;
}

export interface Deal {
  id: string;
  company: string;
  sector: string;
  deal_type: string;
  deal_size_or_revenue_range: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  deal_id: string;
  filename: string;
  mime_type: string;
  doc_kind: string; // freeform: e.g. "Financials", "Contract", "Org/HRIS", "CIM"
  size_bytes: number;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

export interface ChunkRow {
  id: string;
  document_id: string;
  deal_id: string;
  source_doc: string; // denormalized filename, what the model cites
  location: string;
  text: string;
  chunk_index: number;
}

export interface DealContext {
  company: string;
  sector: string;
  deal_type: string;
  deal_size_or_revenue_range: string;
}

export interface MemoRow {
  id: string;
  deal_id: string;
  content: string;
  finding_ids: string[]; // approved findings included
  created_at: string;
}
