import "server-only";

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { dbFindUserByEmail, dbUpdatePassword, isDatabaseConfigured } from "./db";
import { syncPasswordHashToGitHub } from "./githubUserSync";
import { SEED_USERS, type SeedUser } from "./userSeed";

// Credentials-provider user store, in priority order:
//
//   1. A real Postgres database (db.ts), whenever DATABASE_URL is set —
//      genuinely durable, no caveats. Preferred whenever it's available.
//   2. Otherwise, a JSON file at the repo root (data/users.json, gitignored)
//      plus a best-effort commit to GitHub on password changes
//      (githubUserSync.ts) — durable in local dev, and durable-with-a-lag in
//      production if GITHUB_TOKEN is set, but neither is a real database.
//
// This lets the app run with zero setup (falls back to the file), work
// correctly in local dev (file is genuinely durable there), and become a
// real account system the moment DATABASE_URL is configured — no code
// changes required to upgrade.
export type StoredUser = SeedUser;

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

let cache: StoredUser[] | null = null;

function loadFromDisk(): StoredUser[] | null {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as StoredUser[];
  } catch {
    return null;
  }
}

function saveToDisk(users: StoredUser[]): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch {
    return false;
  }
}

function loadUsers(): StoredUser[] {
  if (cache) return cache;
  cache = loadFromDisk() ?? SEED_USERS.map((u) => ({ ...u }));
  saveToDisk(cache);
  return cache;
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  if (isDatabaseConfigured()) return dbFindUserByEmail(email);

  const normalized = email.trim().toLowerCase();
  return loadUsers().find((u) => u.email.toLowerCase() === normalized);
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

export interface UpdatePasswordResult {
  updated: boolean;
  // True = a real database write succeeded — durable everywhere,
  // immediately, no caveats. Only meaningful when a database is configured.
  persistedToDatabase: boolean;
  // Local file write succeeded — durable on a normal filesystem, only
  // instance-local on serverless. Not attempted when a database is
  // configured (the database path is used instead, see module comment).
  durable: boolean;
  // Committed to GitHub (see githubUserSync.ts) — durable everywhere once
  // the resulting auto-deploy finishes. Not attempted when a database is
  // configured; otherwise best-effort on top of the local write.
  syncedToGitHub: boolean;
}

export async function updatePassword(email: string, newPassword: string): Promise<UpdatePasswordResult> {
  const passwordHash = bcrypt.hashSync(newPassword, 10);

  if (isDatabaseConfigured()) {
    const updated = await dbUpdatePassword(email, passwordHash);
    return { updated, persistedToDatabase: updated, durable: false, syncedToGitHub: false };
  }

  const users = loadUsers();
  const normalized = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalized);
  if (!user) return { updated: false, persistedToDatabase: false, durable: false, syncedToGitHub: false };

  user.passwordHash = passwordHash;
  const durable = saveToDisk(users);
  const syncedToGitHub = await syncPasswordHashToGitHub(user.email, passwordHash);
  return { updated: true, persistedToDatabase: false, durable, syncedToGitHub };
}
