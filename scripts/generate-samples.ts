/**
 * Generates a realistic sample data room for "Project Atlas" into ./sample-data.
 * Reproducible: run `npm run generate-samples` (or it runs automatically as part
 * of `npm run seed`). Files are deliberately seeded with concrete, internally
 * consistent numbers so the full analysis — including the Operational peer
 * benchmark — surfaces on the first real analysis run.
 *
 * NOTE: all figures here are fictional, for demo purposes only.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import PDFDocument from "pdfkit";

const OUT = path.join(process.cwd(), "sample-data");

function sheetFromAoa(aoa: (string | number)[][]) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

function writeXlsx(
  filename: string,
  sheets: { name: string; aoa: (string | number)[][] }[],
): string {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, sheetFromAoa(s.aoa), s.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const p = path.join(OUT, filename);
  fs.writeFileSync(p, buf);
  return p;
}

// ── 1. Financials (XLSX) ─────────────────────────────────────────────────────
function financials(): string {
  return writeXlsx("Project_Atlas_Financials.xlsx", [
    {
      name: "P&L Summary",
      aoa: [
        ["Atlas Logistics — P&L Summary (LTM, $000s)", "", ""],
        ["Line item", "LTM", "Prior LTM"],
        ["Revenue", 41200, 35900],
        ["Cost of Revenue", 12100, 10750],
        ["Gross Profit", 29100, 25150],
        ["Gross Margin %", "70.6%", "70.1%"],
        ["Operating Expenses", 22400, 19900],
        ["Reported EBITDA", 6700, 5250],
        ["Adjusted EBITDA (per management)", 9350, 7600],
        ["Adjusted EBITDA Margin %", "22.7%", "21.2%"],
      ],
    },
    {
      name: "EBITDA Adjustments",
      aoa: [
        ["EBITDA Add-backs / Adjustments (LTM, $000s)", ""],
        ["Item", "Amount"],
        ["Reported EBITDA", 6700],
        ["Owner compensation normalization", 1100],
        ['"One-time" rebranding & marketing campaign', 900],
        ["Founder personal travel & vehicle reclassified", 250],
        ["Reversal of prior-year litigation reserve", 400],
        ["Run-rate adjustment for new logos (annualized)", 0],
        ["Adjusted EBITDA", 9350],
        [
          "Note",
          'The rebranding campaign recurs annually; the same line appeared in the prior LTM bridge.',
        ],
      ],
    },
    {
      name: "Customer Concentration",
      aoa: [
        ["Customer Concentration (LTM revenue, $000s)", "", ""],
        ["Customer", "LTM Revenue", "% of Revenue"],
        ["GlobalRetail Corp", 9650, "23.4%"],
        ["Northwind Freight", 8200, "19.9%"],
        ["Meridian Foods", 6050, "14.7%"],
        ["Cedar Freight (terminated 2024)", 0, "0.0%"],
        ["All other (47 customers)", 17300, "42.0%"],
        ["Total", 41200, "100.0%"],
        ["Top 3 concentration", 23900, "58.0%"],
      ],
    },
    {
      name: "Debt & Covenants",
      aoa: [
        ["Debt Schedule", "", ""],
        ["Instrument", "Balance ($000s)", "Detail"],
        ["Senior Term Loan", 14000, "Matures Sep 2026; amortizes 5%/yr"],
        ["Revolving Credit Facility", 3000, "$5.0M commitment; $3.0M drawn"],
        [
          "Covenant — Net Leverage",
          "",
          "Max 3.5x; current 3.1x (headroom thin on reported EBITDA basis: 2.6x adj.)",
        ],
        [
          "Covenant — Fixed Charge Coverage",
          "",
          "Min 1.25x; current 1.30x",
        ],
      ],
    },
    {
      name: "Related Party",
      aoa: [
        ["Related-Party Transactions (LTM)", ""],
        ["Counterparty", "Detail"],
        [
          "Atlas Freight LLC (100% owned by CEO)",
          "Last-mile logistics services purchased by the Company: $1.40M LTM, on terms not market-tested.",
        ],
        [
          "Founder family office",
          "Office sublease at $0.22M/yr; lease assignable on change of control.",
        ],
      ],
    },
  ]);
}

// ── 2. Org chart / HRIS (XLSX) ───────────────────────────────────────────────
function orgHris(): string {
  return writeXlsx("Project_Atlas_Org_and_Headcount.xlsx", [
    {
      name: "Headcount by Function",
      aoa: [
        ["Atlas Logistics — Headcount & Org Structure (current)", "", "", "", "", ""],
        [
          "Function",
          "Headcount",
          "# Managers",
          "Avg direct reports / manager",
          "# Management layers",
          "Avg fully-loaded cost / FTE ($)",
        ],
        ["Engineering", 78, 32, 2.4, 5, 165000],
        ["Sales", 40, 9, 4.4, 3, 140000],
        ["Customer Success", 26, 8, 3.25, 4, 110000],
        ["G&A (Finance/HR/Legal)", 22, 7, 3.1, 4, 120000],
        ["Operations", 30, 6, 5.0, 3, 95000],
        ["Total / Weighted", 196, 62, 3.16, 5, 136800],
      ],
    },
    {
      name: "Company Summary",
      aoa: [
        ["Metric", "Value"],
        ["Revenue (LTM)", "$41.2M"],
        ["Total headcount", 196],
        ["Total annual people cost", "$26.8M"],
        ["Revenue per FTE", "$210,000"],
        ["People cost as % of revenue", "65.0%"],
        ["Management roles (total)", 62],
        ["Managers as % of headcount", "31.6%"],
      ],
    },
    {
      name: "Engineering Layers",
      aoa: [
        ["Engineering reporting layers (IC to top)", ""],
        ["Layer", "Title"],
        ["1", "Individual Contributor (Engineer)"],
        ["2", "Team Lead"],
        ["3", "Engineering Manager"],
        ["4", "Senior Engineering Manager / Director"],
        ["5", "VP Engineering"],
        [
          "Note",
          "78 engineers across 32 managers = 2.4 direct reports per manager; 5 layers from IC to VP.",
        ],
      ],
    },
  ]);
}

// ── 3. Master Services Agreement (DOCX) ──────────────────────────────────────
async function msa(): Promise<string> {
  const clause = (num: string, title: string, body: string) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: `${num} ${title}`, bold: true })],
    }),
    new Paragraph({ children: [new TextRun(body)] }),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: "MASTER SERVICES AGREEMENT",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Between Atlas Logistics, Inc. (“Provider”) and GlobalRetail Corp (“Customer”). This Agreement governs Customer's use of the Atlas platform. Annual contract value: $9.65M (see Schedule A).",
              ),
            ],
          }),
          ...clause(
            "8.1",
            "Term",
            "The initial term is twenty-four (24) months and auto-renews for successive twelve (12) month terms unless either party gives ninety (90) days' written notice of non-renewal prior to the end of the then-current term.",
          ),
          ...clause(
            "8.2",
            "Change of Control",
            "Upon a Change of Control of Provider, Customer may terminate this Agreement for convenience upon thirty (30) days' written notice without penalty or early-termination fee. A “Change of Control” includes any sale of a majority of Provider's equity or substantially all of its assets.",
          ),
          ...clause(
            "9.1",
            "Exclusivity",
            "During the Term, Customer shall use the Provider platform as its exclusive logistics-optimization system for its North American operations; Provider shall not, during the Term, contract with GlobalRetail Corp's two largest named competitors (Schedule C) for the same use case.",
          ),
          ...clause(
            "12.3",
            "Intellectual Property; Contractor Work",
            "Provider represents that platform IP is owned by Provider, except that certain routing-engine components were developed by third-party contractors in 2021–2022 whose assignment-of-inventions agreements are being collected; Provider shall use commercially reasonable efforts to obtain any missing assignments.",
          ),
          ...clause(
            "14.2",
            "Pricing; Most-Favored Customer",
            "Provider warrants that the per-shipment pricing in Schedule A is no higher than that offered to any other customer of comparable volume; if Provider offers lower pricing to a comparable customer, Customer's pricing shall be reduced to match.",
          ),
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: "Schedule A Commercial Terms", bold: true })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Annual contract value $9,650,000. Volume: ~14.2M shipments/yr. Renewal: auto-renew per §8.1. GlobalRetail Corp represented 23.4% of Provider LTM revenue.",
              ),
            ],
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const p = path.join(OUT, "Atlas_MSA_GlobalRetail.docx");
  fs.writeFileSync(p, buf);
  return p;
}

// ── 4. CIM excerpt / business overview (PDF) ────────────────────────────────
function cim(): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = path.join(OUT, "Project_Atlas_CIM_Excerpt.pdf");
    const doc = new PDFDocument({ margin: 54 });
    const stream = fs.createWriteStream(p);
    doc.pipe(stream);

    const h = (t: string) =>
      doc.moveDown(0.6).fontSize(13).fillColor("#0f1d33").text(t, { underline: false }).fontSize(10.5).fillColor("#1b2738").moveDown(0.2);
    const para = (t: string) => doc.text(t, { align: "left" }).moveDown(0.4);

    doc.fontSize(17).fillColor("#0b1626").text("Project Atlas — Confidential Information Memorandum (Excerpt)");
    doc.moveDown(0.3).fontSize(9).fillColor("#5a6b82").text("Prepared for prospective investors. Fictional, demo data only.");
    doc.moveDown(0.6).fontSize(10.5).fillColor("#1b2738");

    h("1. Business Overview");
    para(
      "Atlas Logistics, Inc. is a B2B logistics-optimization software platform serving mid-market shippers and 3PLs across North America. The Company generated $41.2M of LTM revenue (up from $35.9M), at a 70.6% gross margin, with management-adjusted EBITDA of $9.35M.",
    );

    h("2. Commercial Profile & Moat");
    para(
      "The Company reports gross logo retention of 88% and net revenue retention of 104% over the LTM. Management attributes its moat to a proprietary routing engine and deep ERP integrations that create switching costs. The weighted sales pipeline is $11.8M; historical win rate on qualified opportunities is approximately 22%, implying ~$2.6M of expected bookings against a stated FY plan of $4.0M of new ARR.",
    );

    h("3. Customer Base");
    para(
      "The top three customers — GlobalRetail Corp, Northwind Freight, and Meridian Foods — represent 58% of LTM revenue. GlobalRetail Corp alone is 23.4%. The GlobalRetail master services agreement contains a change-of-control termination right (see legal data room).",
    );

    h("4. Key People & Operations");
    para(
      "The co-founder and CTO personally architected and continues to maintain the core routing engine; there is no documented succession plan or second owner for this system. Engineering comprises 78 of 196 employees across five management layers.",
    );

    h("5. Litigation & Contingencies");
    para(
      "In 2024 a former customer, Cedar Freight, filed a claim alleging service-level breaches and seeking approximately $0.6M in damages; the matter is unresolved. The Company reversed a related $0.4M litigation reserve in the current period, which management has added back to EBITDA.",
    );

    h("6. Vendors");
    para(
      "Cloud infrastructure is single-sourced to one hyperscaler (~$1.9M/yr) with no committed-use discount or secondary region. Last-mile services are partly provided by Atlas Freight LLC, an entity owned by the CEO (a related party).",
    );

    doc.end();
    stream.on("finish", () => resolve(p));
    stream.on("error", reject);
  });
}

export async function generateSamples(): Promise<string[]> {
  fs.mkdirSync(OUT, { recursive: true });
  const files: string[] = [];
  files.push(financials());
  files.push(orgHris());
  files.push(await msa());
  files.push(await cim());
  return files;
}

// Run directly: `npm run generate-samples`
if (process.argv[1] && process.argv[1].includes("generate-samples")) {
  generateSamples()
    .then((files) => {
      console.log("Generated sample documents:");
      for (const f of files) console.log("  •", path.relative(process.cwd(), f));
    })
    .catch((err) => {
      console.error("Failed to generate samples:", err);
      process.exit(1);
    });
}
