// JSON Schema for the findings array, used with the Anthropic structured-outputs
// feature (output_config.format) so the model returns parseable JSON matching the
// Part A schema. This is a reliability aid layered on top of the verbatim prompt —
// the pipeline still parses defensively in case structured output is unavailable.

const evidenceItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    source_doc: { type: "string" },
    location: { type: "string" },
    quote_or_value: { type: "string" },
  },
  required: ["source_doc", "location", "quote_or_value"],
};

const benchmarkObject = {
  type: "object",
  additionalProperties: false,
  properties: {
    metric: { type: "string" },
    target_value: { type: "string" },
    peer_benchmark_range: { type: "string" },
    deviation: { type: "string" },
    benchmark_source_note: { type: "string" },
  },
  required: [
    "metric",
    "target_value",
    "peer_benchmark_range",
    "deviation",
    "benchmark_source_note",
  ],
};

const finding = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    category: {
      type: "string",
      enum: ["Financial", "Legal", "Commercial", "Operational"],
    },
    finding_type: {
      type: "string",
      enum: ["Risk", "Opportunity", "Open Question"],
    },
    title: { type: "string" },
    severity: { type: ["string", "null"], enum: ["High", "Medium", "Low", null] },
    rationale: { type: "string" },
    evidence: { type: "array", items: evidenceItem },
    benchmark: { anyOf: [benchmarkObject, { type: "null" }] },
    estimated_value_impact: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    needs_human_review: { type: "boolean" },
  },
  required: [
    "id",
    "category",
    "finding_type",
    "title",
    "severity",
    "rationale",
    "evidence",
    "benchmark",
    "estimated_value_impact",
    "confidence",
    "needs_human_review",
  ],
};

// Top-level array of findings.
export const FINDINGS_SCHEMA = {
  type: "array",
  items: finding,
};
