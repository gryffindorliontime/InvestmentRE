import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteProject, updateProject } from "@/lib/projectsStore";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const project = await updateProject(session.user.email, idNum, {
    name: typeof body?.name === "string" ? body.name.trim() || undefined : undefined,
    filters: body?.filters,
    assumptions: body?.assumptions,
    sort: body?.sort,
    view: body?.view === "map" || body?.view === "table" ? body.view : undefined,
  });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });

  const ok = await deleteProject(session.user.email, idNum);
  if (!ok) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
