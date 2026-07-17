import "server-only";

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { SEED_USERS, type SeedUser } from "./userSeed";

// Credentials-provider user store. There's no database here, so this reads
// and writes a JSON file at the repo root (data/users.json, gitignored —
// runtime password changes should never get committed). That file is
// writable and durable on a normal filesystem (local dev, a VM, a
// long-running container), so signup/reset there works exactly like a real
// account system.
//
// On Vercel-style serverless, the filesystem is read-only outside /tmp:
// writes below fail silently and the change only lives in this warm
// instance's in-memory cache until the next cold start. updatePassword()
// reports this via its `durable` flag so callers (the reset-password route)
// can tell the user honestly rather than claim a permanent change that
// isn't. The real fix for production is a database — this is the
// zero-setup stand-in for local dev and demos.
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

export function findUserByEmail(email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase();
  return loadUsers().find((u) => u.email.toLowerCase() === normalized);
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

export interface UpdatePasswordResult {
  updated: boolean;
  // false = only changed in this server instance's memory (no writable
  // disk) — the caller should tell the user this may not stick.
  durable: boolean;
}

export function updatePassword(email: string, newPassword: string): UpdatePasswordResult {
  const users = loadUsers();
  const normalized = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalized);
  if (!user) return { updated: false, durable: false };

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  return { updated: true, durable: saveToDisk(users) };
}
