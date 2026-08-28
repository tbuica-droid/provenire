"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewDealForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");
  const [dealType, setDealType] = useState("Buyout / Majority");
  const [size, setSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          sector,
          deal_type: dealType,
          deal_size_or_revenue_range: size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create deal");
      router.push(`/deals/${data.deal.id}`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field">
        <label className="label">Target company *</label>
        <input
          className="input"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Project Atlas (Atlas Logistics)"
          required
        />
      </div>
      <div className="field">
        <label className="label">Sector *</label>
        <input
          className="input"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="e.g. B2B Logistics Software"
          required
        />
      </div>
      <div className="field">
        <label className="label">Deal type *</label>
        <select
          className="select"
          value={dealType}
          onChange={(e) => setDealType(e.target.value)}
        >
          <option>Buyout / Majority</option>
          <option>Growth Equity / Minority</option>
          <option>Add-on / Bolt-on</option>
          <option>Carve-out</option>
          <option>Corporate M&A</option>
        </select>
      </div>
      <div className="field">
        <label className="label">
          Approx. deal size / revenue range
          <span className="muted small"> — scales materiality judgments</span>
        </label>
        <input
          className="input"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="e.g. ~$40M revenue, ~$80–100M EV"
        />
      </div>
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? <span className="spinner" /> : null}
        {busy ? "Creating…" : "Create deal"}
      </button>
    </form>
  );
}
