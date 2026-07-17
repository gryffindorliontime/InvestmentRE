import "server-only";

// Durability for password resets in production: this app's serverless
// functions have no writable persistent disk (see userStore.ts), so the
// one thing that IS durable and already present — this app's own GitHub
// repo — doubles as the "database". A successful reset commits the updated
// bcrypt hash straight to src/lib/userSeedData.json on `main`; the next
// deploy (Vercel auto-deploys every push to `main`) bakes that hash in
// permanently, and the current running instance already has the change in
// memory in the meantime (see userStore.ts's in-memory cache).
//
// Requires GITHUB_TOKEN — a fine-grained personal access token scoped to
// ONLY this repo, with Contents: Read and write permission and nothing
// else. Without it, this is skipped entirely (best-effort, same
// graceful-degradation pattern as SMTP/Google below).
//
// Trade-offs worth knowing, not hidden: (1) every reset becomes a public,
// permanent commit — the timestamp of the change and the resulting bcrypt
// hash are visible in git history forever, even after a later reset
// replaces it; (2) each commit triggers a full Vercel production
// redeployment (30-60s) before the change is baked into a fresh cold
// start everywhere.
const REPO_OWNER = "gryffindorliontime";
const REPO_NAME = "InvestmentRE";
const FILE_PATH = "src/lib/userSeedData.json";
const BRANCH = "main";

interface SeedUserRecord {
  email: string;
  name: string;
  passwordHash: string;
}

function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function githubApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
}

// Commits the new password hash for one seed account to GitHub. Returns
// true only on a confirmed successful commit — false (never throws) for
// "not configured" or any failure, so callers can treat this as purely
// best-effort on top of the local file store.
export async function syncPasswordHashToGitHub(email: string, passwordHash: string): Promise<boolean> {
  if (!githubConfigured()) return false;

  try {
    const getRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${BRANCH}`
    );
    if (!getRes.ok) return false;
    const current = (await getRes.json()) as { sha: string; content: string };

    const users = JSON.parse(Buffer.from(current.content, "base64").toString("utf8")) as SeedUserRecord[];
    const normalized = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) return false;
    user.passwordHash = passwordHash;

    const updatedContent = Buffer.from(JSON.stringify(users, null, 2) + "\n", "utf8").toString("base64");

    const putRes = await githubApi(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Password reset for ${user.email}`,
        content: updatedContent,
        sha: current.sha,
        branch: BRANCH,
      }),
    });
    return putRes.ok;
  } catch {
    return false;
  }
}
