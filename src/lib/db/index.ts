import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

// Singleton connection. The db file lives under data/ (gitignored). For a
// production deployment this would move to a managed store with encryption at
// rest and access controls — see SECURITY notes in the README. Today it is a
// local file on disk with no encryption.

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

  const dbPath = path.join(dataDir, "provenire.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  _db = db;
  return db;
}
