import { NextRequest, NextResponse } from "next/server";
import { getPropertyTaxRecord } from "@/lib/rentcastClient";

// Costs exactly 1 RentCast API call. Called on demand from the property
// detail drawer — never for every row in a search result — so quota usage
// stays proportional to what the user actually looks at.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  const city = params.get("city");
  const state = params.get("state");
  const zip = params.get("zip");

  if (!address || !city || !state || !zip) {
    return NextResponse.json({ error: "address, city, state, and zip are required" }, { status: 400 });
  }

  try {
    const record = await getPropertyTaxRecord(`${address}, ${city}, ${state} ${zip}`);
    // record is null when RentCast has no county tax data for the address —
    // a valid outcome, not an error.
    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("disabled") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
