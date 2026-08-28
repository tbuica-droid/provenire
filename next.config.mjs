/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native / Node-only modules used in route handlers must not be bundled by Next.
  serverExternalPackages: [
    "better-sqlite3",
    "pdfjs-dist",
    "mammoth",
    "xlsx",
    "docx",
    "@xenova/transformers",
  ],
};

export default nextConfig;
