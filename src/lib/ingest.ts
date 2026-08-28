import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  extractAndChunk,
  inferDocKind,
  mimeFor,
} from "./parsing";
import { embedTexts, configuredEmbedder } from "./retrieval/embed";
import { createDocument, insertChunks } from "./db/repo";
import type { DocumentRow } from "./types";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// Parse → chunk → (optionally embed) → persist a single document for a deal.
// Shared by the upload API route and the seed script so behaviour is identical.
export async function ingestDocument(
  dealId: string,
  filename: string,
  buffer: Buffer,
  providedMime?: string,
): Promise<DocumentRow> {
  const mime = mimeFor(filename, providedMime);
  const docKind = inferDocKind(filename);

  const { charCount, chunks } = await extractAndChunk(filename, mime, buffer);

  const docId = randomUUID();

  // Persist the original file (so a future version could render the source).
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeName = `${docId}__${path.basename(filename)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buffer);

  // Optional semantic embedding at ingest time (lexical mode stores no vectors).
  let embeddings: { embedder: string; vectors: (Float32Array | null)[] } | undefined;
  if (configuredEmbedder() === "local" && chunks.length > 0) {
    const vectors = await embedTexts(chunks.map((c) => c.text));
    if (vectors) embeddings = { embedder: "local", vectors };
  }

  const doc = createDocument({
    id: docId,
    deal_id: dealId,
    filename,
    mime_type: mime,
    doc_kind: docKind,
    size_bytes: buffer.length,
    char_count: charCount,
    chunk_count: chunks.length,
  });

  insertChunks(
    chunks.map((c) => ({
      document_id: docId,
      deal_id: dealId,
      source_doc: c.source_doc,
      location: c.location,
      text: c.text,
      chunk_index: c.chunk_index,
    })),
    embeddings,
  );

  return doc;
}
