import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Provenire — AI-powered M&A due diligence",
  description:
    "Provenire assembles grounded, citation-backed diligence findings and a draft IC memo from a data room.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="inner">
            <Link href="/" className="brand" style={{ textDecoration: "none" }}>
              <span className="logo">Provenire</span>
              <span className="tag">AI-assisted M&amp;A due diligence</span>
            </Link>
            <nav>
              <Link href="/">Deals</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
