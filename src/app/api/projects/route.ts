import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { createProject, listProjects } from "@/lib/projectsStore";

// Proxy already redirects signed-out page/browser requests to /login, but
// that's an optimistic check on the cookie only — every route handler here
// re-derives the session itself so data is scoped to whoever is actually
// asking, never trusted from the client.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Projects require a database, which isn't configured." }, { status: 503 });
  }

  const projects = await listProjects(session.user.email);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Projects require a database, which isn't configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });

  const project = await createProject(session.user.email, {
    name,
    filters: body.filters,
    assumptions: body.assumptions,
    sort: body.sort,
    view: body.view === "map" ? "map" : "table",
  });
  return NextResponse.json({ project });
}
