import { getDealChunks, type StoredChunk } from "../db/repo";
import {
  tokenize,
  embedQuery,
  bufferToFloat32,
  cosine,
  configuredEmbedder,
} from "./embed";
import type { Category } from "../types";
import { CATEGORY_QUERIES } from "../ai/prompts";

export interface RetrievedChunk {
  source_doc: string;
  location: string;
  text: string;
  score: number;
}

// ── Lexical (TF-IDF) scoring over the deal's own chunks ──────────────────────
// Real retrieval: build IDF over the corpus, vectorize query + chunks, cosine.
function lexicalRank(
  chunks: StoredChunk[],
  query: string,
  k: number,
): RetrievedChunk[] {
  const N = chunks.length;
  const df = new Map<string, number>();
  const chunkTokens = chunks.map((c) => tokenize(c.text));

  for (const toks of chunkTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = (t: string) => Math.log(1 + N / ((df.get(t) ?? 0) + 1));

  const vectorize = (toks: string[]): Map<string, number> => {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [t, f] of tf) vec.set(t, (f / toks.length) * idf(t));
    return vec;
  };

  const dot = (a: Map<string, number>, b: Map<string, number>) => {
    let s = 0;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    for (const [t, w] of small) {
      const w2 = big.get(t);
      if (w2) s += w * w2;
    }
    return s;
  };
  const norm = (a: Map<string, number>) => {
    let s = 0;
    for (const w of a.values()) s += w * w;
    return Math.sqrt(s);
  };

  const qVec = vectorize(tokenize(query));
  const qNorm = norm(qVec) || 1;

  return chunks
    .map((c, i) => {
      const v = vectorize(chunkTokens[i]);
      const denom = (norm(v) || 1) * qNorm;
      return {
        source_doc: c.source_doc,
        location: c.location,
        text: c.text,
        score: denom ? dot(qVec, v) / denom : 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

async function semanticRank(
  chunks: StoredChunk[],
  query: string,
  k: number,
): Promise<RetrievedChunk[] | null> {
  const haveVectors = chunks.every((c) => c.embedding && c.embedder === "local");
  if (!haveVectors) return null;
  const qVec = await embedQuery(query);
  if (!qVec) return null;

  return chunks
    .map((c) => ({
      source_doc: c.source_doc,
      location: c.location,
      text: c.text,
      score: cosine(qVec, bufferToFloat32(c.embedding as Buffer)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Retrieve the top-K chunks for a (deal, category) pair. The category's checklist
// query (CATEGORY_QUERIES) is what we embed/score against — this is the retrieval
// half of the Part C invocation contract: only chunks surfaced here become
// citable evidence for that category's analysis call.
export async function retrieveForCategory(
  dealId: string,
  category: Category,
  k: number,
): Promise<RetrievedChunk[]> {
  const chunks = getDealChunks(dealId);
  if (chunks.length === 0) return [];
  const query = CATEGORY_QUERIES[category];

  if (configuredEmbedder() === "local") {
    const semantic = await semanticRank(chunks, query, k);
    if (semantic) return semantic.filter((c) => c.score > 0);
  }
  return lexicalRank(chunks, query, k).filter((c) => c.score > 0);
}
