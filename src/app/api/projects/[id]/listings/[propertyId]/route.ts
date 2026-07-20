import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { removeSavedListing } from "@/lib/projectsStore";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, propertyId } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });

  const ok = await removeSavedListing(session.user.email, idNum, decodeURIComponent(propertyId));
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
