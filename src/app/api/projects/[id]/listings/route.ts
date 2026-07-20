import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSavedListings, saveListing } from "@/lib/projectsStore";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });

  const listings = await listSavedListings(session.user.email, idNum);
  if (listings === null) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body?.property?.id || !body?.rentEstimate) {
    return NextResponse.json({ error: "property and rentEstimate are required." }, { status: 400 });
  }

  const ok = await saveListing(session.user.email, idNum, body.property, body.rentEstimate);
  if (!ok) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
