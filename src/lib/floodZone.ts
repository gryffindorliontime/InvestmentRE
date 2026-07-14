// FEMA National Flood Hazard Layer lookup (free public ArcGIS endpoint, no
// API key). Server-side only — called from /api/flood-zone. Layer 28 is the
// "Flood Hazard Zones" polygon layer; a point-in-polygon query returns the
// effective FIRM zone for a coordinate.

import type { FloodZoneInfo, FloodRiskLevel } from "./types";

const NFHL_QUERY_URL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

interface NfhlResponse {
  features?: { attributes: { FLD_ZONE?: string; ZONE_SUBTY?: string } }[];
  error?: { message?: string };
}

// FEMA zone → plain-English risk. A*/V* zones are Special Flood Hazard Areas
// (1%+ annual chance — lenders generally require flood insurance). Shaded X
// (0.2% annual chance) is moderate; unshaded X is minimal; D is unmapped.
function riskLevelFor(zone: string, subtype: string): FloodRiskLevel {
  const z = zone.toUpperCase();
  if (z.startsWith("A") && z !== "AREA NOT INCLUDED") return "High";
  if (z.startsWith("V")) return "High";
  if (z === "X") {
    return subtype.toUpperCase().includes("0.2 PCT") ? "Moderate" : "Minimal";
  }
  return "Undetermined";
}

// The FEMA endpoint intermittently drops connections under load, so give
// each lookup one retry before failing.
async function fetchWithRetry(url: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetch(url);
  }
}

// Returns null when FEMA has no flood map covering the point (rare — mostly
// unmapped rural areas and territories).
export async function fetchFloodZone(lat: number, lng: number): Promise<FloodZoneInfo | null> {
  const url = new URL(NFHL_QUERY_URL);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "FLD_ZONE,ZONE_SUBTY");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    throw new Error(`FEMA NFHL error ${res.status}`);
  }
  const data = (await res.json()) as NfhlResponse;
  if (data.error) {
    throw new Error(`FEMA NFHL error: ${data.error.message ?? "unknown"}`);
  }

  const attributes = data.features?.[0]?.attributes;
  if (!attributes?.FLD_ZONE) return null;

  const zone = attributes.FLD_ZONE;
  const subtype = attributes.ZONE_SUBTY ?? "";
  return {
    zone,
    subtype: subtype || undefined,
    riskLevel: riskLevelFor(zone, subtype),
  };
}
