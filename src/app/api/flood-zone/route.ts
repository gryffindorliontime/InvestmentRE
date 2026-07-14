import { NextRequest, NextResponse } from "next/server";
import { fetchFloodZone } from "@/lib/floodZone";

// Free FEMA National Flood Hazard Layer lookup — no RentCast quota involved.
// Called on demand from the property detail drawer.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }

  try {
    const floodZone = await fetchFloodZone(lat, lng);
    // null → FEMA has no flood map for this point; a valid outcome.
    return NextResponse.json({ floodZone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
