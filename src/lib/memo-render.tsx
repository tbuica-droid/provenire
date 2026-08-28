import React from "react";

// Minimal renderer for the memo's structured text (Part B emits section headers
// + body, lightly marked up). Deliberately not a general Markdown engine: the
// memo's shape is known and narrow, and the .docx export (export-docx.ts) parses
// the same constructs, so both surfaces stay in agreement without a dependency.

// Inline: **bold** segments, everything else literal.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMemo(body: string): React.ReactNode[] {
  const lines = body.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    nodes.push(
      <ul className="memo-list" key={`ul-${nodes.length}`}>
        {items.map((b, i) => (
          <li key={i}>{renderInline(b, `li-${nodes.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();

    if (line === "") {
      flushBullets();
      return;
    }
    // Horizontal rule
    if (/^-{3,}$/.test(line) || /^_{3,}$/.test(line)) {
      flushBullets();
      nodes.push(<hr className="memo-hr" key={`hr-${idx}`} />);
      return;
    }
    // Headings (# .. ####)
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushBullets();
      const level = h[1].length;
      const text = h[2].replace(/\*\*/g, "").trim();
      const cls = `memo-h${Math.min(level, 3)}`;
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as
        | "h2"
        | "h3"
        | "h4";
      nodes.push(
        <Tag className={cls} key={`h-${idx}`}>
          {text}
        </Tag>,
      );
      return;
    }
    // Bullets
    const b = line.match(/^[-*•]\s+(.*)$/);
    if (b) {
      bullets.push(b[1]);
      return;
    }
    // A standalone fully-bold line acts as a sub-heading in practice.
    const boldOnly = line.match(/^\*\*(.+)\*\*:?$/);
    if (boldOnly) {
      flushBullets();
      nodes.push(
        <h4 className="memo-h3" key={`hb-${idx}`}>
          {boldOnly[1]}
        </h4>,
      );
      return;
    }

    flushBullets();
    nodes.push(
      <p className="memo-p" key={`p-${idx}`}>
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });

  flushBullets();
  return nodes;
}
