import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import type {
  Deal,
  DealContext,
  DocumentRow,
  ChunkRow,
  Finding,
  RawFinding,
  Evidence,
  ReviewStatus,
  MemoRow,
} from "../types";

const now = () => new Date().toISOString();

// ── Deals ────────────────────────────────────────────────────────────────────

export function createDeal(input: {
  company: string;
  sector: string;
  deal_type: string;
  deal_size_or_revenue_range: string;
  id?: string;
}): Deal {
  const db = getDb();
  const deal: Deal = {
    id: input.id ?? randomUUID(),
    company: input.company.trim(),
    sector: input.sector.trim(),
    deal_type: input.deal_type.trim(),
    deal_size_or_revenue_range: input.deal_size_or_revenue_range.trim(),
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO deals (id, company, sector, deal_type, deal_size_or_revenue_range, created_at)
     VALUES (@id, @company, @sector, @deal_type, @deal_size_or_revenue_range, @created_at)`,
  ).run(deal);
  return deal;
}

export function listDeals(): Deal[] {
  return getDb()
    .prepare(`SELECT * FROM deals ORDER BY created_at DESC`)
    .all() as Deal[];
}

export function getDeal(id: string): Deal | undefined {
  return getDb().prepare(`SELECT * FROM deals WHERE id = ?`).get(id) as
    | Deal
    | undefined;
}

export function dealContext(deal: Deal): DealContext {
  return {
    company: deal.company,
    sector: deal.sector,
    deal_type: deal.deal_type,
    deal_size_or_revenue_range: deal.deal_size_or_revenue_range,
  };
}

// ── Documents ────────────────────────────────────────────────────────────────

export function createDocument(input: {
  deal_id: string;
  filename: string;
  mime_type: string;
  doc_kind: string;
  size_bytes: number;
  char_count: number;
  chunk_count: number;
  id?: string;
}): DocumentRow {
  const db = getDb();
  const doc: DocumentRow = {
    id: input.id ?? randomUUID(),
    deal_id: input.deal_id,
    filename: input.filename,
    mime_type: input.mime_type,
    doc_kind: input.doc_kind,
    size_bytes: input.size_bytes,
    char_count: input.char_count,
    chunk_count: input.chunk_count,
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO documents (id, deal_id, filename, mime_type, doc_kind, size_bytes, char_count, chunk_count, created_at)
     VALUES (@id, @deal_id, @filename, @mime_type, @doc_kind, @size_bytes, @char_count, @chunk_count, @created_at)`,
  ).run(doc);
  return doc;
}

export function listDocuments(dealId: string): DocumentRow[] {
  return getDb()
    .prepare(`SELECT * FROM documents WHERE deal_id = ? ORDER BY created_at ASC`)
    .all(dealId) as DocumentRow[];
}

// ── Chunks ───────────────────────────────────────────────────────────────────

export function insertChunks(
  chunks: Omit<ChunkRow, "id">[],
  embeddings?: { embedder: string; vectors: (Float32Array | null)[] },
): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO chunks (id, document_id, deal_id, source_doc, location, text, chunk_index, embedding, embedder)
     VALUES (@id, @document_id, @deal_id, @source_doc, @location, @text, @chunk_index, @embedding, @embedder)`,
  );
  const tx = db.transaction((rows: Omit<ChunkRow, "id">[]) => {
    rows.forEach((c, i) => {
      const vec = embeddings?.vectors[i] ?? null;
      stmt.run({
        ...c,
        id: randomUUID(),
        embedding: vec ? Buffer.from(vec.buffer) : null,
        embedder: embeddings?.embedder ?? null,
      });
    });
  });
  tx(chunks);
}

export interface StoredChunk extends ChunkRow {
  embedding: Buffer | null;
  embedder: string | null;
}

export function getDealChunks(dealId: string): StoredChunk[] {
  return getDb()
    .prepare(`SELECT * FROM chunks WHERE deal_id = ? ORDER BY chunk_index ASC`)
    .all(dealId) as StoredChunk[];
}

export function chunkCount(dealId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM chunks WHERE deal_id = ?`)
    .get(dealId) as { n: number };
  return row.n;
}

// ── Findings ─────────────────────────────────────────────────────────────────

interface FindingDbRow {
  id: string;
  deal_id: string;
  run_id: string;
  category: string;
  finding_type: string;
  title: string;
  severity: string | null;
  rationale: string;
  estimated_value_impact: string | null;
  benchmark_metric: string | null;
  benchmark_target_value: string | null;
  benchmark_peer_range: string | null;
  benchmark_deviation: string | null;
  benchmark_source_note: string | null;
  confidence: string;
  needs_human_review: number;
  grounded: number;
  review_status: string;
  reviewed_at: string | null;
  created_at: string;
}

function hydrate(row: FindingDbRow, evidence: Evidence[]): Finding {
  const benchmark = row.benchmark_metric
    ? {
        metric: row.benchmark_metric,
        target_value: row.benchmark_target_value ?? "",
        peer_benchmark_range: row.benchmark_peer_range ?? "",
        deviation: row.benchmark_deviation ?? "",
        benchmark_source_note: row.benchmark_source_note ?? "",
      }
    : null;
  return {
    id: row.id,
    deal_id: row.deal_id,
    run_id: row.run_id,
    category: row.category as Finding["category"],
    finding_type: row.finding_type as Finding["finding_type"],
    title: row.title,
    severity: row.severity as Finding["severity"],
    rationale: row.rationale,
    estimated_value_impact: row.estimated_value_impact,
    benchmark,
    confidence: row.confidence as Finding["confidence"],
    needs_human_review: !!row.needs_human_review,
    grounded: !!row.grounded,
    review_status: row.review_status as ReviewStatus,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    evidence,
  };
}

// Clears any prior findings for a deal then writes the new run atomically.
export function replaceFindings(
  dealId: string,
  runId: string,
  findings: (RawFinding & { grounded: boolean })[],
): void {
  const db = getDb();
  const insFinding = db.prepare(
    `INSERT INTO findings (
       id, deal_id, run_id, category, finding_type, title, severity, rationale,
       estimated_value_impact, benchmark_metric, benchmark_target_value,
       benchmark_peer_range, benchmark_deviation, benchmark_source_note,
       confidence, needs_human_review, grounded, review_status, reviewed_at, created_at
     ) VALUES (
       @id, @deal_id, @run_id, @category, @finding_type, @title, @severity, @rationale,
       @estimated_value_impact, @benchmark_metric, @benchmark_target_value,
       @benchmark_peer_range, @benchmark_deviation, @benchmark_source_note,
       @confidence, @needs_human_review, @grounded, 'pending', NULL, @created_at
     )`,
  );
  const insEvidence = db.prepare(
    `INSERT INTO finding_evidence (finding_id, source_doc, location, quote_or_value)
     VALUES (?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM findings WHERE deal_id = ?`).run(dealId);
    const ts = now();
    for (const f of findings) {
      insFinding.run({
        id: f.id,
        deal_id: dealId,
        run_id: runId,
        category: f.category,
        finding_type: f.finding_type,
        title: f.title,
        severity: f.severity,
        rationale: f.rationale,
        estimated_value_impact: f.estimated_value_impact,
        benchmark_metric: f.benchmark?.metric ?? null,
        benchmark_target_value: f.benchmark?.target_value ?? null,
        benchmark_peer_range: f.benchmark?.peer_benchmark_range ?? null,
        benchmark_deviation: f.benchmark?.deviation ?? null,
        benchmark_source_note: f.benchmark?.benchmark_source_note ?? null,
        confidence: f.confidence,
        needs_human_review: f.needs_human_review ? 1 : 0,
        grounded: f.grounded ? 1 : 0,
        created_at: ts,
      });
      for (const e of f.evidence) {
        insEvidence.run(f.id, e.source_doc, e.location, e.quote_or_value);
      }
    }
  });
  tx();
}

export function listFindings(dealId: string): Finding[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM findings WHERE deal_id = ? ORDER BY created_at ASC`)
    .all(dealId) as FindingDbRow[];
  const evStmt = db.prepare(
    `SELECT source_doc, location, quote_or_value FROM finding_evidence WHERE finding_id = ?`,
  );
  return rows.map((r) => hydrate(r, evStmt.all(r.id) as Evidence[]));
}

export function getFinding(id: string): Finding | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM findings WHERE id = ?`).get(id) as
    | FindingDbRow
    | undefined;
  if (!row) return undefined;
  const ev = db
    .prepare(
      `SELECT source_doc, location, quote_or_value FROM finding_evidence WHERE finding_id = ?`,
    )
    .all(id) as Evidence[];
  return hydrate(row, ev);
}

// Memo-inclusion set = the human-reviewed findings: explicitly approved, plus
// edited (edited = the analyst's revised version, kept for inclusion). Pending
// and rejected findings are never passed to the memo.
export function listApprovedFindings(dealId: string): Finding[] {
  return listFindings(dealId).filter(
    (f) => f.review_status === "approved" || f.review_status === "edited",
  );
}

// Update review status and/or editable fields. Editing flips status to "edited"
// unless an explicit status is given. Editing is itself a form of approval-with-
// changes, so "edited" findings are treated as approved for the memo (see memo route).
export function updateFinding(
  id: string,
  patch: {
    review_status?: ReviewStatus;
    title?: string;
    rationale?: string;
    severity?: string | null;
    finding_type?: string;
    estimated_value_impact?: string | null;
  },
): Finding | undefined {
  const db = getDb();
  const existing = getFinding(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const key of [
    "review_status",
    "title",
    "rationale",
    "severity",
    "finding_type",
    "estimated_value_impact",
  ] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = patch[key];
    }
  }
  if (patch.review_status) {
    fields.push(`reviewed_at = @reviewed_at`);
    params.reviewed_at = now();
  }
  if (fields.length === 0) return existing;

  db.prepare(`UPDATE findings SET ${fields.join(", ")} WHERE id = @id`).run(
    params,
  );
  return getFinding(id);
}

export function findingReviewSummary(dealId: string): {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  edited: number;
} {
  const rows = getDb()
    .prepare(
      `SELECT review_status AS s, COUNT(*) AS n FROM findings WHERE deal_id = ? GROUP BY review_status`,
    )
    .all(dealId) as { s: ReviewStatus; n: number }[];
  const out = { total: 0, approved: 0, rejected: 0, pending: 0, edited: 0 };
  for (const r of rows) {
    out[r.s] = r.n;
    out.total += r.n;
  }
  return out;
}

// ── Memos ────────────────────────────────────────────────────────────────────

export function saveMemo(
  dealId: string,
  content: string,
  findingIds: string[],
): MemoRow {
  const db = getDb();
  const memo: MemoRow = {
    id: randomUUID(),
    deal_id: dealId,
    content,
    finding_ids: findingIds,
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO memos (id, deal_id, content, finding_ids, created_at)
     VALUES (@id, @deal_id, @content, @finding_ids, @created_at)`,
  ).run({ ...memo, finding_ids: JSON.stringify(findingIds) });
  return memo;
}

export function latestMemo(dealId: string): MemoRow | undefined {
  const row = getDb()
    .prepare(
      `SELECT * FROM memos WHERE deal_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(dealId) as
    | (Omit<MemoRow, "finding_ids"> & { finding_ids: string })
    | undefined;
  if (!row) return undefined;
  return { ...row, finding_ids: JSON.parse(row.finding_ids || "[]") };
}
