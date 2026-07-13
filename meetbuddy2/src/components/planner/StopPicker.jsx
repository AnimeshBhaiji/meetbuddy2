// src/components/planner/StopPicker.jsx
// One picker for both "swap this stop" and "add a stop": cached suggestions
// first (free), fresh anchored search on demand, or a custom geocoded place.
import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Star, MapPin, Loader2 } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import { STEP_EMOJI, humanStepName } from "@/hooks/usePlannerSession";

const CATEGORIES = ["restaurant", "cafe", "activity", "stay"];
const placeKey = (p) => p.place_id || p.title;

function PlaceRow({ o, onPick }) {
  return (
    <button
      onClick={() => onPick(o)}
      className="w-full text-left glass rounded-xl p-3.5 hover:bg-white/10 hover:border-brand/40 border border-transparent transition-all cursor-pointer flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{o.title || o.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{o.address}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0 text-xs">
        {o.rating && (
          <span className="text-yellow-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400" /> {o.rating}
          </span>
        )}
        {o.distance_meters != null && (
          <span className="text-brand-3">
            {o.distance_meters < 1000
              ? `${Math.round(o.distance_meters)} m`
              : `${(o.distance_meters / 1000).toFixed(1)} km`}
          </span>
        )}
      </div>
    </button>
  );
}

export default function StopPicker({ open, category, anchor, prefs, cachedOptions = {},
                                     excludeKeys = [], onPick, onClose }) {
  const [tab, setTab] = useState("suggestions"); // suggestions | search | custom
  const [searchCat, setSearchCat] = useState(category || "restaurant");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // custom tab
  const [customText, setCustomText] = useState("");
  const [customCoords, setCustomCoords] = useState(null);

  useEffect(() => {
    if (open) {
      setTab("suggestions"); setSearchCat(category || "restaurant");
      setResults(null); setError(null); setCustomText(""); setCustomCoords(null);
    }
  }, [open, category]);

  const suggestions = (cachedOptions[category] || []).filter((o) => !excludeKeys.includes(placeKey(o)));

  const runSearch = async () => {
    if (!anchor) { setError("No location to search around."); return; }
    setLoading(true); setError(null);
    try {
      const res = await axios.post("http://localhost:8000/planner/options",
        { category: searchCat, anchor, preferences: prefs || {} }, { timeout: 60000 });
      if (res.data.search_error) setError(`Search failed: ${res.data.search_error}`);
      setResults((res.data.options || []).filter((o) => !excludeKeys.includes(placeKey(o))));
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const locateCustom = async () => {
    if (!customText.trim()) return;
    setLoading(true); setError(null); setCustomCoords(null);
    try {
      const res = await axios.get("http://localhost:8000/geocode",
        { params: { q: customText.trim() }, timeout: 30000 });
      setCustomCoords(res.data);
    } catch {
      setError("Couldn't find that address — you can still add it without a map pin.");
    } finally {
      setLoading(false);
    }
  };

  const addCustom = () => {
    onPick({ title: customText.trim(), address: customText.trim(),
             lat: customCoords?.lat ?? null, lng: customCoords?.lng ?? null }, "custom");
  };

  const TABS = [["suggestions", "Suggestions"], ["search", "Find more"], ["custom", "Custom place"]];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/10"
          >
            <div className="p-5 pb-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex gap-1.5">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                      tab === key ? "glass text-white border border-white/25" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={onClose} aria-label="Close"
                      className="p-2 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 min-h-[200px]">
              {error && <p className="text-sm text-red-300">{error}</p>}

              {tab === "suggestions" && (
                suggestions.length > 0 ? (
                  suggestions.slice(0, 10).map((o) => (
                    <PlaceRow key={placeKey(o)} o={o} onPick={(p) => onPick(p, category)} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No unused suggestions for this step — try "Find more".
                  </p>
                )
              )}

              {tab === "search" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap pb-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSearchCat(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                          searchCat === c
                            ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50"
                            : "glass text-foreground/75 hover:bg-white/10"
                        }`}
                      >
                        {STEP_EMOJI[c]} {humanStepName(c)}
                      </button>
                    ))}
                    <GlowButton onClick={runSearch} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                    </GlowButton>
                  </div>
                  {results && results.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nothing found nearby.</p>
                  )}
                  {(results || []).slice(0, 10).map((o) => (
                    <PlaceRow key={placeKey(o)} o={o} onPick={(p) => onPick(p, searchCat)} />
                  ))}
                </>
              )}

              {tab === "custom" && (
                <div className="space-y-3">
                  <input
                    value={customText}
                    onChange={(e) => { setCustomText(e.target.value); setCustomCoords(null); }}
                    onKeyDown={(e) => e.key === "Enter" && locateCustom()}
                    placeholder="Place name or address…"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-brand/60"
                  />
                  <div className="flex gap-2">
                    <GlowButton variant="ghost" onClick={locateCustom} disabled={loading || !customText.trim()}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Locate
                    </GlowButton>
                    <GlowButton onClick={addCustom} disabled={!customText.trim()}>
                      Add to itinerary
                    </GlowButton>
                  </div>
                  {customCoords && (
                    <p className="text-xs text-brand-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Found: {customCoords.lat.toFixed(4)}, {customCoords.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
