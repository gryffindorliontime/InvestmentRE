// Demo accounts for the credentials (email/password) sign-in path, seeded on
// first run. All three share one demo password — Demo1234! — disclosed to
// whoever set this app up; it is unrelated to and not derived from any real
// password on these email providers. This file is bundled into the repo, so
// treat these as public, low-stakes demo credentials, not real secrets:
// anyone who reads the source can sign into this app as any of them.
export interface SeedUser {
  email: string;
  name: string;
  // bcrypt hash of "Demo1234!" — see the userStore module for verification.
  passwordHash: string;
}

const DEMO_PASSWORD_HASH = "$2b$10$A/hFIpVmovM2xMbI82lsM.HG6Lv5rwfMHpbUVR6Y0SImcbog2tdS.";

export const SEED_USERS: SeedUser[] = [
  { email: "rohanamin789@gmail.com", name: "Rohan Amin", passwordHash: DEMO_PASSWORD_HASH },
  { email: "mamin123@yahoo.com", name: "M Amin", passwordHash: DEMO_PASSWORD_HASH },
  { email: "amiamin2003@yahoo.com", name: "Ami Amin", passwordHash: DEMO_PASSWORD_HASH },
];
