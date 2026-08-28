"use client";

import { useState } from "react";
import type { Finding, ReviewStatus, Severity } from "@/lib/types";

const sevClass: Record<string, string> = {
  High: "b-high",
  Medium: "b-med",
  Low: "b-low",
};
const typeClass: Record<string, string> = {
  Risk: "b-risk",
  Opportunity: "b-opportunity",
  "Open Question": "b-open",
};

export interface FindingPatch {
  review_status?: ReviewStatus;
  title?: string;
  rationale?: string;
  severity?: Severity;
  finding_type?: string;
  estimated_value_impact?: string | null;
}

export default function FindingCard({
  finding,
  onPatch,
}: {
  finding: Finding;
  onPatch: (id: string, patch: FindingPatch) => Promise<void>;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // editable fields
  const [title, setTitle] = useState(finding.title);
  const [rationale, setRationale] = useState(finding.rationale);
  const [severity, setSeverity] = useState<string>(finding.severity ?? "");
  const [ftype, setFtype] = useState<string>(finding.finding_type);
  const [impact, setImpact] = useState(finding.estimated_value_impact ?? "");

  async function act(action: string, patch: FindingPatch) {
    setBusy(action);
    try {
      await onPatch(finding.id, patch);
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    await act("save", {
      title,
      rationale,
      severity: (severity || null) as Severity,
      finding_type: ftype,
      estimated_value_impact: impact.trim() === "" ? null : impact,
    });
    setEditing(false);
  }

  const statusClass =
    finding.review_status === "rejected"
      ? "is-rejected"
      : finding.review_status === "approved" || finding.review_status === "edited"
        ? "is-approved"
        : "";

  return (
    <div
      className={`finding ${finding.category === "Operational" ? "is-operational" : ""} ${statusClass}`}
    >
      <div className="finding-top">
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ marginBottom: 8, fontWeight: 600 }}
            />
          ) : (
            <h3 className="finding-title">{finding.title}</h3>
          )}

          <div className="finding-meta">
            <span className={`badge ${typeClass[finding.finding_type] || "b-open"}`}>
              {finding.finding_type}
            </span>
            {finding.severity && (
              <span className={`badge ${sevClass[finding.severity]}`}>
                {finding.severity}
              </span>
            )}
            <span className="chip">{finding.category}</span>
            <span className="chip">Confidence: {finding.confidence}</span>
            {finding.needs_human_review && (
              <span className="badge b-review" title="Flagged by the model / pipeline for human review">
                ⚑ Needs human review
              </span>
            )}
            {!finding.grounded && (
              <span
                className="badge b-ungrounded"
                title="The cited source was not found in the retrieved chunks; surfaced as an Open Question by the grounding backstop."
              >
                ⚠ Ungrounded citation
              </span>
            )}
            <span className="spacer" />
            <span className="small muted">
              <span className={`status-dot dot-${finding.review_status}`} />
              {finding.review_status}
            </span>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="grid-2" style={{ marginTop: 4 }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Rationale</label>
            <textarea
              className="textarea"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Finding type</label>
            <select
              className="select"
              value={ftype}
              onChange={(e) => setFtype(e.target.value)}
            >
              <option>Risk</option>
              <option>Opportunity</option>
              <option>Open Question</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Severity</label>
            <select
              className="select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">None (Open Question)</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Estimated value impact</label>
            <input
              className="input"
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="e.g. $1.4–1.9M run-rate cost-out, methodology: …"
            />
          </div>
        </div>
      ) : (
        <>
          <p className="rationale">{finding.rationale}</p>

          {finding.estimated_value_impact && (
            <div className="impact">
              <span className="lbl">Estimated value impact</span>
              {finding.estimated_value_impact}
            </div>
          )}

          {finding.benchmark && (
            <div className="benchmark">
              <div className="bk-title">⬡ Peer benchmark comparison</div>
              <div className="bk-grid">
                <div className="bk-item">
                  <div className="k">Metric</div>
                  <div className="v">{finding.benchmark.metric}</div>
                </div>
                <div className="bk-item">
                  <div className="k">Target</div>
                  <div className="v">{finding.benchmark.target_value}</div>
                </div>
                <div className="bk-item">
                  <div className="k">Peer range</div>
                  <div className="v">{finding.benchmark.peer_benchmark_range}</div>
                </div>
                <div className="bk-item">
                  <div className="k">Deviation</div>
                  <div className="v">{finding.benchmark.deviation}</div>
                </div>
              </div>
              {finding.benchmark.benchmark_source_note && (
                <div className="note">
                  Benchmark basis: {finding.benchmark.benchmark_source_note}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="finding-actions">
        {!editing && (
          <button className="link-btn" onClick={() => setShowEvidence((s) => !s)}>
            {showEvidence ? "Hide sources" : `View sources (${finding.evidence.length})`}
          </button>
        )}
        <span className="spacer" />

        {editing ? (
          <>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={saveEdit}
              disabled={busy === "save"}
            >
              {busy === "save" ? <span className="spinner" /> : null} Save changes
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setEditing(true)}
              disabled={!!busy}
            >
              Edit
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => act("reject", { review_status: "rejected" })}
              disabled={!!busy}
            >
              {busy === "reject" ? <span className="spinner dark" /> : null} Reject
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => act("approve", { review_status: "approved" })}
              disabled={!!busy}
            >
              {busy === "approve" ? <span className="spinner" /> : null} Approve
            </button>
          </>
        )}
      </div>

      {showEvidence && !editing && (
        <div className="evidence">
          {finding.evidence.length === 0 ? (
            <div className="muted small">
              No source citations — this is an Open Question explaining what
              evidence is missing.
            </div>
          ) : (
            finding.evidence.map((e, i) => (
              <div className="evidence-item" key={i}>
                <span className="src">{e.source_doc}</span>
                <span className="loc">{e.location}</span>
                {e.quote_or_value && <div className="quote">{e.quote_or_value}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
