"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EnrichedListing } from "@/lib/searchEngine";

// Leaflet's default marker icons reference image paths that don't survive
// bundling — build our own colored pins instead (also lets us encode cap
// rate at a glance without a legend lookup).
function makePinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 16px; height: 16px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

const PIN_GOOD = makePinIcon("#059669"); // cap rate >= 6%
const PIN_OK = makePinIcon("#d97706"); // 3-6%
const PIN_POOR = makePinIcon("#dc2626"); // < 3%

function pinFor(capRatePct: number): L.DivIcon {
  if (capRatePct >= 6) return PIN_GOOD;
  if (capRatePct >= 3) return PIN_OK;
  return PIN_POOR;
}

function FitBounds({ listings }: { listings: EnrichedListing[] }) {
  const map = useMap();
  useEffect(() => {
    const points = listings
      .filter((l) => l.property.lat && l.property.lng)
      .map((l) => [l.property.lat, l.property.lng] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [listings, map]);
  return null;
}

interface PropertyMapProps {
  listings: EnrichedListing[];
  onSelect: (listing: EnrichedListing) => void;
}

export function PropertyMap({ listings, onSelect }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const withCoords = useMemo(
    () => listings.filter((l) => l.property.lat && l.property.lng),
    [listings]
  );

  const defaultCenter: [number, number] = withCoords[0]
    ? [withCoords[0].property.lat, withCoords[0].property.lng]
    : [32.7767, -96.797]; // Dallas, TX — reasonable default when nothing has coords yet

  return (
    <div ref={containerRef} className="relative flex-1">
      <MapContainer center={defaultCenter} zoom={11} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds listings={withCoords} />
        {withCoords.map((listing) => (
          <Marker
            key={listing.property.id}
            position={[listing.property.lat, listing.property.lng]}
            icon={pinFor(listing.roi.capRatePct)}
            eventHandlers={{ click: () => onSelect(listing) }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{listing.property.address}</p>
                <p className="text-xs text-slate-500">
                  {listing.property.city}, {listing.property.state} {listing.property.zip}
                </p>
                <p className="mt-1">{formatCurrency(listing.property.price)}</p>
                <p>
                  Cap rate: <span className="font-medium">{formatPercent(listing.roi.capRatePct)}</span>
                </p>
                <p>Est. rent: {formatCurrency(listing.rentEstimate.monthlyRent)}/mo</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {withCoords.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-slate-500">
          No properties with coordinates to plot.
        </div>
      )}
    </div>
  );
}
