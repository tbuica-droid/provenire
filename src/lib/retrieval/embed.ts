// Embedding strategy. Default is "lexical" (deterministic TF-IDF, computed at
// query time over the deal's own chunks — no model download, fully offline).
// "local" uses @xenova/transformers (all-MiniLM-L6-v2) if installed.
//
// The embedder is intentionally swappable: a production system would drop in a
// hosted embeddings provider (e.g. Voyage) behind this same interface without
// touching the retriever or analysis layers.

export type EmbedderId = "lexical" | "local";

export function configuredEmbedder(): EmbedderId {
  const v = (process.env.PROVENIRE_EMBEDDER ?? "lexical").toLowerCase();
  return v === "local" ? "local" : "lexical";
}

const STOPWORDS = new Set(
  "a an and are as at be by for from has have in is it its of on or that the to was were will with this these those which than then".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%.\- ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((t) => t.length >= 2 && t.length <= 40 && !STOPWORDS.has(t));
}

// ── Semantic (local) embedder ────────────────────────────────────────────────

let _pipePromise: Promise<any> | null = null;
let _localUnavailable = false;

async function getLocalPipeline(): Promise<any | null> {
  if (_localUnavailable) return null;
  if (_pipePromise) return _pipePromise;
  _pipePromise = (async () => {
    try {
      // Optional dependency — resolved at runtime only. The non-literal module
      // name keeps it out of static bundling/type resolution; absence is handled.
      const moduleName: string = "@xenova/transformers";
      const mod: any = await import(/* webpackIgnore: true */ moduleName);
      const pipeline = mod.pipeline ?? mod.default?.pipeline;
      return await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    } catch (err) {
      console.warn(
        "[provenire] PROVENIRE_EMBEDDER=local but @xenova/transformers is unavailable; falling back to lexical retrieval.",
        (err as Error)?.message,
      );
      _localUnavailable = true;
      return null;
    }
  })();
  return _pipePromise;
}

// Returns one Float32Array per input, or null if semantic embedding is not
// active/available (caller should then use lexical retrieval).
export async function embedTexts(
  texts: string[],
): Promise<Float32Array[] | null> {
  if (configuredEmbedder() !== "local") return null;
  const pipe = await getLocalPipeline();
  if (!pipe) return null;
  const out: Float32Array[] = [];
  for (const t of texts) {
    const res = await pipe(t.slice(0, 4000), {
      pooling: "mean",
      normalize: true,
    });
    out.push(Float32Array.from(res.data as Iterable<number>));
  }
  return out;
}

export async function embedQuery(text: string): Promise<Float32Array | null> {
  const v = await embedTexts([text]);
  return v ? v[0] : null;
}

export function bufferToFloat32(buf: Buffer): Float32Array {
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(copy);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
