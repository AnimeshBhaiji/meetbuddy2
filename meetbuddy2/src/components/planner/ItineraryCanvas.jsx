// src/components/planner/ItineraryCanvas.jsx
// "Your perfect itinerary" as an editable route canvas. All edits are local:
// the map redraws instantly, nothing cascades, Save persists to the API.
import { useMemo, useState } from "react";
import axios from "axios";
import { motion, Reorder } from "framer-motion";
import { GripVertical, RefreshCw, X, Plus, StickyNote, Rocket, Printer,
         Save, PartyPopper, Check } from "lucide-react";
import MapPlanner from "@/components/MapPlanner";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import StopPicker from "./StopPicker";
import { STEP_EMOJI, humanStepName, deriveServiceNotes } from "@/hooks/usePlannerSession";

const haversineKm = (a, b) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
};

const stopKey = (s) => s.place?.place_id || s.place?.title || "";

export default function ItineraryCanvas({ P, initialItinerary = null }) {
  const { userPrefs, user, selectedChain, optionsByStep, setPage, setSessionId, setSelectedChain } = P;

  const [stops, setStops] = useState(() =>
    initialItinerary
      ? initialItinerary.stops.map((s) => (s._uid ? s : { ...s, _uid: crypto.randomUUID() }))
      : selectedChain.map((s) => ({ step: s.step, place: s.place, note: "", _uid: crypto.randomUUID() }))
  );
  const [title, setTitle] = useState(initialItinerary?.title || `${userPrefs?.mood || "My"} meetup plan`);
  const [plannedDate, setPlannedDate] = useState(initialItinerary?.planned_date || "");
  const [savedId, setSavedId] = useState(initialItinerary?.id || null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [noteOpen, setNoteOpen] = useState(null);     // stop _uid with the note field open
  // picker: {mode: "swap"|"add", index, category}
  const [picker, setPicker] = useState(null);

  const coordsOf = (s) =>
    s.place?.lat != null && s.place?.lng != null
      ? { lat: Number(s.place.lat), lng: Number(s.place.lng) } : null;

  const totalKm = useMemo(() => {
    const pts = stops.map(coordsOf).filter(Boolean);
    let km = 0;
    for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
    return km;
  }, [stops]);

  // anchor a picker search to the stop before the insertion point (or first stop)
  const pickerAnchor = (index) => {
    for (let i = Math.min(index, stops.length) - 1; i >= 0; i--) {
      const c = coordsOf(stops[i]);
      if (c) return c;
    }
    return stops.map(coordsOf).find(Boolean) || (userPrefs?.coords ?? null);
  };

  const applyPick = (place, step) => {
    setStops((cur) => {
      const next = [...cur];
      if (picker.mode === "swap") next[picker.index] = { ...next[picker.index], step, place };
      else next.splice(picker.index, 0, { step, place, note: "", _uid: crypto.randomUUID() });
      return next;
    });
    setPicker(null);
    setSaveState("idle");
    setNoteOpen(null);
  };

  const save = async () => {
    if (!user) return;
    setSaveState("saving");
    const payload = { user_id: user.user_id, title: title.trim() || "Untitled plan",
                      planned_date: plannedDate || null, stops };
    try {
      const res = savedId
        ? await axios.put(`http://localhost:8000/itineraries/${savedId}`, payload, { timeout: 30000 })
        : await axios.post("http://localhost:8000/itineraries", payload, { timeout: 30000 });
      setSavedId(res.data.id);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const planAnother = () => { setPage("home"); setSessionId(null); setSelectedChain([]); };
  const serviceNotes = deriveServiceNotes(userPrefs);

  const AddBetween = ({ index }) => (
    <button
      onClick={() => setPicker({ mode: "add", index, category: "restaurant" })}
      className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-brand-3/70 hover:text-brand-3 transition-colors cursor-pointer print:hidden"
    >
      <Plus className="w-3 h-3" /> add a stop here
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 mb-5 print:hidden">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center glow-sm">
          <PartyPopper className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Your perfect <span className="text-gradient">itinerary</span>
          </h1>
          <p className="text-sm text-muted-foreground">Drag, swap, and tweak until it's yours.</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* -------- map hero -------- */}
        <div className="relative glass-strong rounded-3xl overflow-hidden border border-white/10 min-h-[420px] lg:min-h-[600px]">
          <MapPlanner
            className="absolute inset-0"
            options={[]}
            selectedChain={stops}
          />
          <div className="absolute bottom-3 left-3 z-[1000] glass-strong rounded-xl px-3.5 py-2 text-xs text-foreground/85 border border-white/10">
            {stops.length} stop{stops.length === 1 ? "" : "s"}
            {totalKm > 0 && <> · ~{totalKm.toFixed(1)} km route</>}
          </div>
        </div>

        {/* -------- editing panel -------- */}
        <GlassCard variant="gradient" className="p-6">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaveState("idle"); }}
            className="w-full bg-transparent text-xl font-semibold text-white outline-none border-b border-transparent focus:border-brand/40 pb-1 mb-2"
            aria-label="Itinerary title"
          />
          <input
            type="date"
            value={plannedDate || ""}
            onChange={(e) => { setPlannedDate(e.target.value); setSaveState("idle"); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground/85 outline-none focus:border-brand/50 mb-5 [color-scheme:dark]"
            aria-label="Planned date"
          />

          <AddBetween index={0} />
          <Reorder.Group axis="y" values={stops} onReorder={(v) => { setStops(v); setSaveState("idle"); setNoteOpen(null); }} className="space-y-1">
            {stops.map((s, i) => (
              <div key={s._uid}>
                <Reorder.Item value={s} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 print:hidden" />
                  <span className="w-6 h-6 shrink-0 bg-gradient-to-br from-brand to-brand-2 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-brand-3 uppercase tracking-wider">
                      {STEP_EMOJI[s.step] ?? "📍"} {humanStepName(s.step)}
                    </p>
                    <p className="text-sm text-white font-medium truncate">{s.place?.title || s.place?.name}</p>
                    {s.note && <p className="text-xs text-muted-foreground truncate">📝 {s.note}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0 print:hidden">
                    <button onClick={() => setNoteOpen(noteOpen === s._uid ? null : s._uid)} aria-label="Edit note"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                      <StickyNote className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPicker({ mode: "swap", index: i, category: s.step === "custom" ? "restaurant" : s.step })}
                            aria-label="Swap stop"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setStops((cur) => cur.filter((_, j) => j !== i)); setSaveState("idle"); setNoteOpen(null); }}
                            aria-label="Remove stop"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-white/10 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Reorder.Item>
                {noteOpen === s._uid && (
                  <input
                    autoFocus
                    value={s.note || ""}
                    onChange={(e) => { const v = e.target.value;
                      setStops((cur) => cur.map((st, j) => (j === i ? { ...st, note: v } : st))); setSaveState("idle"); }}
                    onKeyDown={(e) => e.key === "Enter" && setNoteOpen(null)}
                    onBlur={() => setNoteOpen(null)}
                    placeholder="Add a note — e.g. book a window table"
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-foreground outline-none focus:border-brand/50 print:hidden"
                  />
                )}
                <AddBetween index={i + 1} />
              </div>
            ))}
          </Reorder.Group>

          {stops.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No stops yet — add one above.
            </p>
          )}

          {serviceNotes.length > 0 && (
            <div className="mt-5 glass rounded-2xl p-4 border border-brand/20">
              <p className="text-sm font-semibold text-white mb-2">Don't forget</p>
              <ul className="space-y-1.5">
                {serviceNotes.map((note) => (
                  <li key={note} className="text-xs text-foreground/85">{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2.5 mt-6 print:hidden">
            <GlowButton onClick={save} disabled={saveState === "saving" || stops.length === 0} size="lg" className="w-full">
              {saveState === "saving" ? <RefreshCw className="w-4.5 h-4.5 animate-spin" />
               : saveState === "saved" ? <Check className="w-4.5 h-4.5" /> : <Save className="w-4.5 h-4.5" />}
              {saveState === "saved" ? "Saved!" : savedId ? "Save changes" : "Save itinerary"}
            </GlowButton>
            {saveState === "error" && (
              <p className="text-xs text-red-300 text-center">Couldn't save — your plan is still here, try again.</p>
            )}
            <div className="flex gap-2.5">
              <GlowButton variant="ghost" onClick={() => window.print()} className="flex-1">
                <Printer className="w-4.5 h-4.5" /> Print
              </GlowButton>
              <GlowButton variant="ghost" onClick={planAnother} className="flex-1">
                <Rocket className="w-4.5 h-4.5" /> Plan another
              </GlowButton>
            </div>
          </div>
        </GlassCard>
      </div>

      <StopPicker
        open={picker != null}
        category={picker?.category || "restaurant"}
        anchor={picker ? pickerAnchor(picker.index) : null}
        prefs={userPrefs}
        cachedOptions={optionsByStep}
        excludeKeys={stops.map(stopKey)}
        onPick={applyPick}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
