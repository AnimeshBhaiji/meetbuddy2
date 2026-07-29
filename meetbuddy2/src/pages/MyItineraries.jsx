// src/pages/MyItineraries.jsx
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Trash2, ArrowRight, Rocket } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";

export default function MyItineraries() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const load = async () => {
    if (!user) return setItems([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/itineraries`,
        { params: { user_id: user.user_id }, timeout: 30000 });
      setItems(res.data);
    } catch {
      setError("Couldn't load your itineraries.");
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id) => {
    if (!window.confirm("Delete this itinerary?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/itineraries/${id}`,
        { params: { user_id: user.user_id }, timeout: 30000 });
      setItems((cur) => cur.filter((i) => i.id !== id));
    } catch {
      setError("Delete failed. Please try again.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="min-h-screen pt-28 pb-16 max-w-4xl mx-auto px-6">
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                   className="text-3xl md:text-5xl font-bold text-white mb-8">
          My <span className="text-gradient">itineraries</span>
        </motion.h1>
        {error && <p className="text-sm text-red-300 mb-4">{error}</p>}
        {items === null && <p className="text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <GlassCard variant="strong" className="p-10 text-center">
            <p className="text-foreground/85 mb-5">No saved plans yet — build one and hit Save.</p>
            <GlowButton onClick={() => navigate("/planner")}>
              <Rocket className="w-4.5 h-4.5" /> Plan a meetup
            </GlowButton>
          </GlassCard>
        )}
        <div className="space-y-3">
          {(items || []).map((it, idx) => (
            <motion.div key={it.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}>
              <GlassCard variant="gradient" className="p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-white truncate">{it.title}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {it.stop_count} stops</span>
                    {it.planned_date && (
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {it.planned_date}</span>
                    )}
                  </p>
                </div>
                <GlowButton onClick={() => navigate("/planner", { state: { itineraryId: it.id } })}>
                  Open <ArrowRight className="w-4 h-4" />
                </GlowButton>
                <button onClick={() => remove(it.id)} aria-label="Delete itinerary"
                        className="p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-white/10 cursor-pointer">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
