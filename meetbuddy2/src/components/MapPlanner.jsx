// src/components/MapPlanner.jsx
import React, { useEffect, useMemo, useRef, forwardRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function FitBounds({ points = [] }) {
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
    } catch (err) {
      // swallow fitBounds issues
      // console.warn("FitBounds error", err);
    }
  }, [points, map]);
  return null;
}

// Marker component with ref forwarding to access Leaflet instance
const MarkerWithRef = forwardRef(({ position, icon, children, ...props }, ref) => {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!markerRef.current) return;
    
    // Get the underlying Leaflet marker instance
    const leafletMarker = markerRef.current.leafletElement;
    
    if (!leafletMarker) return;
    
    // Expose methods via ref
    if (ref) {
      ref.current = {
        openPopup: () => {
          if (leafletMarker && leafletMarker.isPopupOpen && !leafletMarker.isPopupOpen()) {
            leafletMarker.openPopup();
          } else if (leafletMarker) {
            leafletMarker.openPopup();
          }
        },
        closePopup: () => {
          if (leafletMarker && leafletMarker.closePopup) {
            leafletMarker.closePopup();
          }
        },
        leafletElement: leafletMarker
      };
    }
  }, [ref]);

  return (
    <Marker ref={markerRef} position={position} icon={icon} {...props}>
      {children}
    </Marker>
  );
});
MarkerWithRef.displayName = "MarkerWithRef";

/**
 * MapPlanner props:
 * - options: array of places (current step)
 * - selectedChain: array [{step, place}]
 * - onSelect(place)
 * - onPreview(place)
 * - highlightedPlace: place object to highlight on map (opens popup)
 * - userCoords: {lat, lng} for user's current location (GPS)
 * - locationText: string typed area/location (for highlighting when no coords)
 */
export default function MapPlanner({ options = [], selectedChain = [], onSelect = () => {}, onPreview = () => {}, highlightedPlace = null, userCoords = null, locationText = "" }) {
  const mapRef = useRef(null);
  const markerRefs = useRef({});

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

  // Build a stable key so MapContainer remounts when dataset changes (safer fitBounds)
  const mapKey = useMemo(() => {
    const optKey = normalizedOptions.map((o) => `${o.lat}:${o.lng}`).join("|");
    const selKey = selectedPlaces.map((s) => `${s.lat}:${s.lng}`).join("|");
    return `${optKey}::${selKey}`;
  }, [normalizedOptions, selectedPlaces]);

  // Open popup when highlightedPlace changes
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Close all popups if no place is highlighted
    if (!highlightedPlace) {
      Object.values(markerRefs.current).forEach((marker) => {
        if (marker && marker.closePopup) {
          try {
            marker.closePopup();
          } catch (e) {
            // Ignore errors if popup is not open
          }
        }
      });
      return;
    }
    
    // Small delay to prevent rapid popup opens on hover
    const timeoutId = setTimeout(() => {
      if (!highlightedPlace || !mapRef.current) return;
      
      // Normalize highlighted place for matching
      const hlLat = highlightedPlace.lat ?? highlightedPlace.latitude ?? highlightedPlace.raw?.lat;
      const hlLng = highlightedPlace.lng ?? highlightedPlace.longitude ?? highlightedPlace.raw?.lng;
      const hlTitle = (highlightedPlace.title || highlightedPlace.name || "").toLowerCase().trim();
      
      // Find the marker for the highlighted place
      let matchedIdx = -1;
      for (let idx = 0; idx < normalizedOptions.length; idx++) {
        const o = normalizedOptions[idx];
        if (o.lat != null && o.lng != null) {
          // Match by coordinates (with small tolerance) or title
          const latMatch = hlLat != null && Math.abs(o.lat - Number(hlLat)) < 0.0001;
          const lngMatch = hlLng != null && Math.abs(o.lng - Number(hlLng)) < 0.0001;
          const titleMatch = hlTitle && (o.title || "").toLowerCase().trim() === hlTitle;
          
          if ((latMatch && lngMatch) || titleMatch) {
            matchedIdx = idx;
            break;
          }
        }
      }
      
      // If we found a match, open the popup
      if (matchedIdx >= 0) {
        const markerKey = `opt-${matchedIdx}`;
        const marker = markerRefs.current[markerKey];
        const option = normalizedOptions[matchedIdx];
        
        if (option) {
          // Only pan if marker is not already visible in viewport (to avoid unnecessary movement)
          const currentCenter = mapRef.current.getCenter();
          const currentZoom = mapRef.current.getZoom();
          const markerLatLng = L.latLng(option.lat, option.lng);
          const distance = currentCenter.distanceTo(markerLatLng);
          
          // Only pan if marker is more than 500m away from center, and preserve zoom level
          if (distance > 500) {
            mapRef.current.setView([option.lat, option.lng], currentZoom, {
              animate: true,
              duration: 0.5
            });
          }
          
          // Try to open popup via ref
          if (marker && marker.openPopup) {
            try {
              // Use a small delay to ensure marker is ready
              setTimeout(() => {
                if (marker && marker.openPopup) {
                  marker.openPopup();
                } else if (marker && marker.leafletElement) {
                  // Fallback: try direct leaflet element access
                  marker.leafletElement.openPopup();
                }
              }, 150);
            } catch (e) {
              console.warn("Failed to open popup via ref:", e);
            }
          } else {
            // Fallback: find marker through map layers
            try {
              const targetLatLng = L.latLng(option.lat, option.lng);
              mapRef.current.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                  const layerLatLng = layer.getLatLng();
                  if (layerLatLng.distanceTo(targetLatLng) < 10) { // within 10 meters
                    layer.openPopup();
                  }
                }
              });
            } catch (e) {
              console.warn("Failed to open popup via map layers:", e);
            }
          }
        }
      }
    }, 100); // 100ms delay for hover
    
    return () => clearTimeout(timeoutId);
  }, [highlightedPlace, normalizedOptions]);

  return (
    <div className="w-full h-[520px] md:h-[640px] rounded-xl overflow-hidden shadow">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(m) => {
          mapRef.current = m;
        }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={[
          ...(userCoords && userCoords.lat != null && userCoords.lng != null ? [userCoords] : []),
          ...normalizedOptions.filter(o => o.lat && o.lng),
          ...selectedPlaces.filter(s => s.lat && s.lng),
        ]} />

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
            <MarkerWithRef 
              key={markerKey} 
              position={[o.lat, o.lng]} 
              icon={defaultIcon}
              ref={(ref) => {
                if (ref) {
                  markerRefs.current[markerKey] = ref;
                } else {
                  delete markerRefs.current[markerKey];
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{o.address}</div>
                  {o.rating != null && <div style={{ marginTop: 6 }}>⭐ {o.rating}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        onSelect({ ...o, raw: o.raw });
                      }}
                      style={{ padding: "6px 10px", background: "#16a34a", color: "white", borderRadius: 6, border: 0 }}
                    >
                      Select
                    </button>
                    {o.link && (
                      <a href={o.link} target="_blank" rel="noreferrer" style={{ padding: "6px 10px", background: "#e5e7eb", borderRadius: 6 }}>
                        Open
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </MarkerWithRef>
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
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{p.address}</div>
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
