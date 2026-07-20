import "server-only";

import { neon } from "@neondatabase/serverless";
import { SEED_USERS } from "./userSeed";

// Real persistence for accounts/passwords: a Postgres table, used whenever
// DATABASE_URL is set. This is what userStore.ts prefers over the JSON-file
// + GitHub-commit fallback (see that file) — a genuine database write is
// durable on its own, no extra mechanism needed. Neon's serverless driver
// talks HTTP, not a pooled TCP connection, so it works cleanly from
// short-lived serverless functions.
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Shared connection accessor — other persistence modules (projectsStore.ts)
// import this rather than opening their own connection.
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

// Creates the table and seeds the three demo accounts on first use, then
// never again for the life of this process. Safe to call on every request —
// CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING make it a no-op
// once the table exists and is seeded.
function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = sql();
    await db`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    for (const user of SEED_USERS) {
      await db`
        INSERT INTO users (email, name, password_hash)
        VALUES (${user.email.toLowerCase()}, ${user.name}, ${user.passwordHash})
        ON CONFLICT (email) DO NOTHING
      `;
    }
  })();
  return schemaReady;
}

export interface DbUser {
  email: string;
  name: string;
  passwordHash: string;
}

export async function dbFindUserByEmail(email: string): Promise<DbUser | undefined> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    SELECT email, name, password_hash AS "passwordHash" FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  return (rows as DbUser[])[0];
}

export async function dbUpdatePassword(email: string, passwordHash: string): Promise<boolean> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
    WHERE email = ${email.trim().toLowerCase()}
    RETURNING email
  `;
  return rows.length > 0;
}
