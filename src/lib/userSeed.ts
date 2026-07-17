import seedData from "./userSeedData.json";

// Demo accounts for the credentials (email/password) sign-in path. Kept in
// userSeedData.json (not inline here) specifically so a password reset can
// rewrite that one file — see lib/githubUserSync.ts — without touching
// TypeScript source. All three start on one demo password — Demo1234! —
// disclosed to whoever set this app up; it is unrelated to and not derived
// from any real password on these email providers. This file is bundled
// into the repo, so treat these as public, low-stakes demo credentials, not
// real secrets: anyone who reads the source can sign into this app as any
// of them (until they're reset).
export interface SeedUser {
  email: string;
  name: string;
  passwordHash: string;
}

export const SEED_USERS: SeedUser[] = seedData;
