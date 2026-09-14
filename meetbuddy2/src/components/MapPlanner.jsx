// src/components/MapPlanner.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DistanceBadge } from "./PlaceEnhancements";

// Fix default Leaflet icon images (works with CRA/Vite)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadowUrl from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** numbered icon */
function createNumberedIcon(number, color = "#ff6b6b") {
  const html = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:34px;height:34px;
      border-radius:17px;
      background:${color};
      color:white;
      font-weight:700;
      font-size:14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      ">
      ${number}
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

const defaultIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:7px;background:#3b82f6;border:2px solid white;"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 14],
  popupAnchor: [0, -14],
});

const userLocationIcon = L.divIcon({
  html: `
    <div style="
      position: relative;
      width:28px;
      height:28px;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        width:24px;
        height:24px;
        border-radius:50%;
        background:#ec4899;
        border:3px solid white;
        box-shadow:0 0 0 3px rgba(236,72,153,0.45);
      "></div>
      <div style="
        position:absolute;
        width:8px;
        height:8px;
        border-radius:50%;
        background:white;
      "></div>
    </div>
  `,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Re-fits only when `signature` (the set of coordinates) changes. Callers pass a
// fresh points array on every render — a card hover, a keystroke — and re-fitting
// on those snapped a map the user had panned back into place.
function FitBounds({ points = [], signature }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points || !points.length) return;
    const valid = points
      .map((p) => {
        // points may be {lat, lng} or [lat, lng]
        if (!p) return null;
        if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
        if (p.lat != null && p.lng != null) return [Number(p.lat), Number(p.lng)];
        return null;
      })
      .filter(Boolean);
    if (!valid.length) return;
    try {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds.pad(0.25));
    } catch {
      // swallow fitBounds issues
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- points is read when the signature changes, not on every new array
  }, [signature, map]);
  return null;
}

/**
 * MapPlanner props:
 * - options: array of places (current step)
 * - selectedChain: array [{step, place}]
 * - highlightedPlace: place object to highlight on map (opens popup)
 * - userCoords: {lat, lng} for user's current location (GPS)
 * - locationText: string typed area/location (for highlighting when no coords)
 */
export default function MapPlanner({
  options = [],
  selectedChain = [],
  highlightedPlace = null,
  userCoords = null,
  locationText = "",
  className = "",
}) {
  const markerRefs = useRef({}); // "opt-<index>" -> Leaflet marker

  // Normalize options to ensure consistent field names and numeric coords
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt, idx) => {
      const latRaw = opt?.lat ?? opt?.latitude ?? opt?.raw?.lat ?? opt?.raw?.latitude ?? opt?.raw?.gps;
      const lngRaw = opt?.lng ?? opt?.longitude ?? opt?.raw?.lng ?? opt?.raw?.longitude;
      let lat = null;
      let lng = null;

      // some datasets return gps as "12.34,77.56"
      if (latRaw == null && opt?.raw?.gps && typeof opt.raw.gps === "string") {
        const parts = opt.raw.gps.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          lat = Number(parts[0]);
          lng = Number(parts[1]);
        }
      } else {
        if (latRaw != null) lat = Number(latRaw);
        if (lngRaw != null) lng = Number(lngRaw);
      }

      if (lat != null && Number.isNaN(lat)) lat = null;
      if (lng != null && Number.isNaN(lng)) lng = null;

      if (lat == null || lng == null) {
        // small debug hint for backend shape issues (non-blocking)
        // console.debug(`MapPlanner: option ${idx} missing numeric coords`, { idx, raw: opt });
      }

      return {
        title: opt.title || opt.name || opt.Name || "Unnamed Place",
        address: opt.address || opt.Address || opt.vicinity || opt.raw?.address || "",
        lat,
        lng,
        rating: opt.rating ?? opt.Rating ?? opt.raw?.rating ?? null,
        link: opt.link || opt.GoogleMaps || opt.website || opt.raw?.link || "",
        distance_meters: opt.distance_meters || opt.raw?.distance_meters || null,
        raw: opt.raw || opt,
        __sourceIndex: idx,
      };
    });
  }, [options]);

  const selectedPlaces = useMemo(() => {
    return (selectedChain || []).map((s) => {
      const place = s?.place || s;
      const latRaw = place?.lat ?? place?.latitude ?? place?.raw?.lat;
      const lngRaw = place?.lng ?? place?.longitude ?? place?.raw?.lng;
      let lat = latRaw != null ? Number(latRaw) : null;
      let lng = lngRaw != null ? Number(lngRaw) : null;
      if (Number.isNaN(lat)) lat = null;
      if (Number.isNaN(lng)) lng = null;
      return {
        title: place.title || place.name || place.Name || "Unnamed Place",
        address: place.address || place.Address || place.vicinity || place.raw?.address || "",
        lat,
        lng,
        rating: place.rating ?? place.Rating ?? place.raw?.rating ?? null,
        link: place.link || place.GoogleMaps || place.website || place.raw?.link || "",
        raw: place.raw || place,
      };
    });
  }, [selectedChain]);

  // Determine center — prefer explicit userCoords, else first valid option, else selected place, else Bangalore fallback
  const firstValid = normalizedOptions.find((o) => o.lat != null && o.lng != null) || selectedPlaces.find((o) => o.lat != null && o.lng != null);
  const center = userCoords && userCoords.lat != null && userCoords.lng != null
    ? [Number(userCoords.lat), Number(userCoords.lng)]
    : (firstValid ? [firstValid.lat, firstValid.lng] : [12.9715987, 77.5945627]);

  // Everything the map should frame. The map is never remounted for new data
  // (that reloaded every tile and marker on each step, sort and filter) — FitBounds
  // re-frames it instead. The signature is sorted, so re-sorting options or
  // reordering stops doesn't re-fit an unchanged set of places.
  const fitPoints = [
    ...(userCoords && userCoords.lat != null && userCoords.lng != null ? [userCoords] : []),
    ...normalizedOptions.filter((o) => o.lat && o.lng),
    ...selectedPlaces.filter((s) => s.lat && s.lng),
  ];
  const fitSignature = fitPoints.map((p) => `${p.lat}:${p.lng}`).sort().join("|");

  // Hovering an option card opens that place's popup. Option popups don't
  // auto-pan, so this never moves a map the user has panned. (It never worked
  // before: react-leaflet v5 ignores `whenCreated` and has no `.leafletElement`.)
  useEffect(() => {
    const markers = markerRefs.current;
    if (!highlightedPlace) {
      Object.values(markers).forEach((m) => m.closePopup());
      return;
    }
    const timeoutId = setTimeout(() => {
      // Cards and markers are built from the same option objects.
      const idx = normalizedOptions.findIndex((o) =>
        o.raw === highlightedPlace ||
        (highlightedPlace.place_id && o.raw?.place_id === highlightedPlace.place_id));
      markers[`opt-${idx}`]?.openPopup();
    }, 100); // skip cards the pointer only sweeps across
    return () => clearTimeout(timeoutId);
  }, [highlightedPlace, normalizedOptions]);

  return (
    <div className={className || "w-full h-[520px] md:h-[640px] rounded-xl overflow-hidden shadow"}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds points={fitPoints} signature={fitSignature} />

        {/* User's current location (GPS) */}
        {userCoords && userCoords.lat != null && userCoords.lng != null && (
          <Marker
            position={[Number(userCoords.lat), Number(userCoords.lng)]}
            icon={userLocationIcon}
          >
            <Popup>
              <div style={{ fontWeight: 600 }}>You are here</div>
              {locationText && (
                <div style={{ fontSize: 12, marginTop: 4 }}>{locationText}</div>
              )}
            </Popup>
          </Marker>
        )}

        {/* Highlight approximate typed area if we have no explicit coords */}
        {!userCoords && locationText && firstValid && (
          <Circle
            center={center}
            radius={1500}
            pathOptions={{ color: "#3b82f6", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.15 }}
          >
            <Popup>
              <div style={{ fontWeight: 600 }}>{locationText}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Approximate area</div>
            </Popup>
          </Circle>
        )}

        {/* unselected options */}
        {normalizedOptions.map((o, idx) => {
          if (o.lat == null || o.lng == null) return null;
          const markerKey = `opt-${idx}`;
          return (
            <Marker
              key={markerKey}
              position={[o.lat, o.lng]}
              icon={defaultIcon}
              ref={(marker) => {
                if (marker) {
                  markerRefs.current[markerKey] = marker;
                } else {
                  delete markerRefs.current[markerKey];
                }
              }}
            >
              <Popup autoPan={false}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: "#a3a9c2", marginTop: 4 }}>{o.address}</div>
                  {o.rating != null && <div style={{ marginTop: 6 }}>⭐ {o.rating}</div>}

                  {/* Distance Badge */}
                  {o.distance_meters && (
                    <DistanceBadge distanceMeters={o.distance_meters} />
                  )}

                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexDirection: 'column' }}>
                    {o.link && (
                      <a
                        href={o.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ width: '100%', padding: "6px 10px", background: 'rgba(255,255,255,0.08)', borderRadius: 6, textDecoration: 'none', color: '#e6e8f2', fontSize: '12px', fontWeight: 600, textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        View Details →
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* selected numbered markers */}
        {selectedPlaces.map((p, i) => {
          if (!p || p.lat == null || p.lng == null) return null;
          return (
            <Marker key={`sel-${i}`} position={[p.lat, p.lng]} icon={createNumberedIcon(i + 1)}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>{`#${i + 1} ${p.title}`}</div>
                  <div style={{ fontSize: 12, color: "#a3a9c2", marginTop: 4 }}>{p.address}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* polyline connecting selected places */}
        {selectedPlaces.length >= 2 && (
          <Polyline positions={selectedPlaces.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng])} pathOptions={{ color: "#ff6b6b", weight: 4, opacity: 0.85 }} />
        )}
      </MapContainer>
    </div>
  );
}
