/**
 * Seeds the sample deal "Project Atlas" with its data room so the full flow is
 * visible on first run. This does NOT call the Anthropic API — it loads, parses,
 * chunks and stores the documents. Click "Run analysis" in the UI (with your API
 * key set) to generate the grounded findings, including the Operational benchmark.
 *
 * Idempotent: if a Project Atlas deal already exists, it is left untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { generateSamples } from "./generate-samples";
import { createDeal, listDeals } from "../src/lib/db/repo";
import { ingestDocument } from "../src/lib/ingest";

const COMPANY = "Project Atlas (Atlas Logistics)";

async function main() {
  // 1. Ensure sample documents exist.
  const files = await generateSamples();

  // 2. Skip if already seeded.
  const existing = listDeals().find((d) => d.company === COMPANY);
  if (existing) {
    console.log(
      `Deal "${COMPANY}" already exists (id ${existing.id}). Nothing to do.`,
    );
    console.log(`Open it at:  http://localhost:3000/deals/${existing.id}`);
    return;
  }

  // 3. Create the deal.
  const deal = createDeal({
    company: COMPANY,
    sector: "B2B Logistics Optimization Software",
    deal_type: "Buyout / Majority",
    deal_size_or_revenue_range: "~$41M LTM revenue, ~$85–100M EV (target ~9–11x adj. EBITDA)",
  });
  console.log(`Created deal "${deal.company}" (id ${deal.id}).`);

  // 4. Ingest each sample document.
  for (const f of files) {
    const filename = path.basename(f);
    const buffer = fs.readFileSync(f);
    const doc = await ingestDocument(deal.id, filename, buffer);
    console.log(
      `  • ingested ${doc.filename} [${doc.doc_kind}] — ${doc.chunk_count} chunks`,
    );
  }

  console.log("\nDone. Next steps:");
  console.log("  1. Add your ANTHROPIC_API_KEY to .env");
  console.log("  2. npm run dev");
  console.log(`  3. Open http://localhost:3000/deals/${deal.id} and click "Run analysis"`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
