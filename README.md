# Provenire

**AI-assisted M&A due-diligence platform — MVP.**

> **Provenire** — from *provenance*: the traceable origin of every claim. That is the
> product's whole premise, so the name is used verbatim everywhere. `Provenire` in
> UI copy, `provenire` in code (package name, folder, routes, `PROVENIRE_*` env
> vars). Same word, no separate slug.

Provenire turns a deal's data room into a prioritized, **citation-grounded** set of
diligence findings (Risks, Opportunities, and Open Questions across Financial,
Legal, Commercial and Operational), puts every finding through a **human
review gate**, and assembles a draft **Investment Committee memo** from only the
approved findings.

The signature differentiator is the **Operational** lens: organizational
benchmarking (span of control, headcount-to-revenue, cost-per-FTE) that surfaces
dollar-denominated cost-out **opportunities** a generalist tool would miss — not
just red flags.

---

## The core loop

```
Create deal → Upload data room → Run analysis (grounded findings)
            → Human review (approve / edit / reject)  ← credibility gate
            → Generate draft IC memo (approved findings only) → Export to .docx
```

---

## Quick start

```bash
# 1. Install
cd provenire
npm install

# 2. Configure your key
cp .env.example .env
#   then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Seed the sample deal "Project Atlas" (generates + ingests 4 sample docs).
#    This does NOT call the API — it only parses/chunks/stores the documents.
npm run seed

# 4. Run
npm run dev
#    open http://localhost:3000  → open Project Atlas → "Run analysis"
```

Running the analysis and generating the memo require a valid
`ANTHROPIC_API_KEY` (they call Claude). Everything else — deal creation,
upload/parse/chunk, the review gate — works without one.

> **Node 18.18+ / 20+ recommended.** `better-sqlite3` builds a native binding on
> install.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on `:3000` |
| `npm run seed` | Generate + ingest the sample "Project Atlas" data room |
| `npm run generate-samples` | (Re)generate just the sample documents into `sample-data/` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run reset-db` | Delete the local SQLite DB (start fresh) |

---

## What's in the sample deal

`npm run seed` creates **Project Atlas** (a fictional $41.2M-revenue logistics
SaaS buyout) with four reproducible, format-diverse documents — covering all
three required file types and all four analysis categories:

| File | Type | Feeds |
|---|---|---|
| `Project_Atlas_Financials.xlsx` | XLSX | customer concentration (top-3 = 58%), aggressive EBITDA add-backs, related-party purchases, debt covenant/maturity |
| `Atlas_MSA_GlobalRetail.docx` | DOCX | change-of-control termination right (§8.2), exclusivity, contractor-IP gap, MFN pricing |
| `Project_Atlas_Org_and_Headcount.xlsx` | XLSX | **org/HRIS** — headcount, managers, span of control (Eng 2.4), 5 layers, cost/FTE, revenue/FTE → the Operational benchmark |
| `Project_Atlas_CIM_Excerpt.pdf` | PDF | moat/pipeline/retention, key-person (CTO), litigation, single-sourced vendor |

All figures are fictional, for demo only.

---

## Architecture & stack (and why)

| Layer | Choice | Why |
|---|---|---|
| App / API / UI | **Next.js 15 (App Router) + React 19, TypeScript** | One process serves the API routes and the React UI; easy to run locally today and to deploy later. |
| Database | **SQLite via `better-sqlite3`** | Zero-config, file-based, synchronous. Real relational schema with **normalized finding columns** (see below). |
| AI | **Anthropic SDK**, model `claude-opus-4-8` (configurable) | Findings use **structured JSON output** (`output_config.format`) so they render as real UI elements; memo is structured text. |
| Parsing | `pdf-parse` (PDF, per-page), `mammoth` (DOCX, heading-aware), SheetJS `xlsx` (per-sheet/row) | Well-supported; each parser emits **located** text segments so citations carry real page/section/clause/cell references. |
| Retrieval | **TF-IDF lexical by default**, optional local semantic embeddings | Chunk → score per category → top-K. Default is deterministic and offline (demo-safe); set `PROVENIRE_EMBEDDER=local` for `@xenova/transformers` semantic embeddings. Pluggable for a hosted provider later. |
| Export | `docx` | Real `.docx` IC memo download. |

### Clean separation (extensible by design)
- `src/lib/parsing/*` — document processing (one module per format).
- `src/lib/retrieval/*` — chunking + embedding + per-category retrieval.
- `src/lib/ai/prompts.ts` — **Parts A & B as verbatim, swappable instruction
  constants** (the IP), kept out of business logic.
- `src/lib/ai/analyze.ts` / `memo.ts` — the Part C invocation contract.
- `src/lib/db/*` — schema + repository.
- `src/app/*`, `src/components/*` — UI.

### The normalized data asset (deliberate)
Every finding's structured fields — `category`, `finding_type`, `severity`,
`benchmark_metric/target_value/peer_range/deviation/source_note`,
`estimated_value_impact` — are stored in **normalized columns** (`findings`
table), with evidence in a related `finding_evidence` table. This is what lets a
**cross-deal benchmarking corpus** be assembled later with plain SQL, without
re-processing old documents.

---

## How the credibility mechanisms are enforced (not just requested)

- **Citations are enforced in code.** After each category call, every piece of
  evidence is validated against the chunks that were actually supplied to that
  call (`analyze.ts → enforceGrounding`). Evidence pointing at an unsupplied
  document is dropped; a finding left with no grounded evidence is **coerced to
  an Open Question**, flagged, and marked `needs_human_review` — the model
  cannot fabricate its way into the dashboard. Ungrounded findings get a visible
  red badge.
- **Hallucination guardrails are surfaced, not buried.** `confidence` and a
  prominent **"⚑ Needs human review"** badge render directly on each card;
  Medium/Low confidence always forces the flag.
- **The review gate is core flow.** Findings persist as `pending`. The memo
  endpoint (`/api/deals/[id]/memo`) reads **only** `approved`/`edited` findings
  and refuses to generate if none have been reviewed in. Nothing flows from AI
  output straight to the memo.
- **The memo disclaimer is mandatory and verbatim.** Part B requires it; the app
  also prepends the exact line as a backstop if the model ever omits it
  (`memo.ts`), and it renders as a banner + in the `.docx` export.

---

## Configuration (`.env`)

| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required** for analysis + memo. |
| `PROVENIRE_ANALYSIS_MODEL` | `claude-opus-4-8` | Model for both calls. Set `claude-sonnet-4-6` for faster/cheaper demos. |
| `PROVENIRE_THINKING` | `adaptive` | `adaptive` or `off`. |
| `PROVENIRE_EFFORT` | `high` | `low` / `medium` / `high` / `max`. |
| `PROVENIRE_EMBEDDER` | `lexical` | `lexical` (offline TF-IDF) or `local` (semantic; needs `npm i @xenova/transformers`). |
| `PROVENIRE_RETRIEVAL_K` | `14` | Chunks retrieved per category. |

---

## Security — what is and isn't implemented

This MVP handles sensitive financial documents, so the boundary matters. Stated
precisely:

**Implemented today**
- Runs locally; data stays on your machine.
- Uploaded files are written to `data/uploads/` (local filesystem) and parsed
  text/chunks are stored in a local **SQLite file** at `data/provenire.db`.
- `data/` and `.env` are git-ignored, so documents and the API key are not
  committed.

**NOT implemented — required before any real client data touches this**
- **Encryption at rest** — the SQLite DB and uploaded files are currently stored
  unencrypted on disk.
- **Authentication / access control / multi-tenant isolation** — there is no
  login; any local user can see any deal.
- **Audit logging, secrets management, network controls, backup/retention &
  deletion workflows.**
- **A formal compliance program (e.g. SOC 2 Type II)** would need to be
  established before production use.

No production security control above is in place yet; treat this strictly as a
local demo, not a system of record for live deals.

---

## Notes & assumptions

- **Default embedder is lexical** to guarantee the live demo runs with only an
  API key and no model download. It's real retrieval (TF-IDF cosine over the
  deal's chunks), and the interface is swappable for semantic/hosted embeddings.
- **`edited` findings count as approved-with-changes** for memo inclusion;
  `pending`/`rejected` never reach the memo.
- Analysis fans out **one call per category** (4 calls/deal) at high effort —
  expect a short wait. Lower `PROVENIRE_EFFORT` or use Sonnet for snappier demos.
