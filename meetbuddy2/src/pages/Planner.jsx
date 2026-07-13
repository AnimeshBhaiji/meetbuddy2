// src/pages/Planner.jsx
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Rocket,
  X,
  Star,
  RotateCcw,
  Printer,
  PartyPopper,
} from "lucide-react";
import Navbar from "../components/Navbar";
import MapPlanner from "../components/MapPlanner";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import usePlannerSession, {
  STEP_EMOJI,
  deriveServiceNotes,
  humanStepName,
} from "@/hooks/usePlannerSession";
import PlannerHome from "@/components/planner/PlannerHome";
import StepExplorer from "@/components/planner/StepExplorer";

// Full-screen overlay with spinner & message
function FullOverlay({ show, text = "Loading next step..." }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-5 glow-sm"
          >
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand border-r-brand-2 animate-spin" />
            </div>
            <div className="text-foreground font-medium">{text}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Planner() {
  const P = usePlannerSession();

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />

      <div className="min-h-screen pt-28 pb-16">
        {/* HOME / preferences panel */}
        {P.page === "home" && <PlannerHome P={P} />}

        {/* STEP PAGE: map-first explorer for the current step */}
        {P.page === "step" && <StepExplorer P={P} />}

        {/* SUMMARY PAGE */}
        {P.page === "summary" && (
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.15 }}
                className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center glow-md"
              >
                <PartyPopper className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-3">
                Your perfect <span className="text-gradient">itinerary</span>
              </h1>
              <p className="text-muted-foreground text-lg">Ready to explore!</p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Itinerary timeline */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <GlassCard variant="gradient" className="p-8 h-full">
                  <h2 className="text-2xl font-semibold text-white mb-8">Your plan</h2>
                  <ol className="relative space-y-8 pl-2">
                    {P.selectedChain.map((s, i) => (
                      <motion.li
                        key={`${s.step}::${s.place?.title ?? i}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + i * 0.15 }}
                        className="flex gap-5 relative"
                      >
                        {/* connector line */}
                        {i < P.selectedChain.length - 1 && (
                          <span className="absolute left-[19px] top-11 bottom-[-32px] w-px bg-gradient-to-b from-brand/60 to-brand-2/30" />
                        )}
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-brand to-brand-2 text-white rounded-full flex items-center justify-center font-bold glow-sm z-10">
                          {i + 1}
                        </div>
                        <div className="pt-0.5 flex-1">
                          <p className="font-semibold text-brand-3 text-sm uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                            {STEP_EMOJI[s.step] ?? "📍"} {humanStepName(s.step)}
                          </p>
                          <p className="text-white font-medium text-lg">
                            {s.place.title || s.place.name || s.place.address}
                          </p>
                          {s.place.address && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {s.place.address}
                            </p>
                          )}
                          {P.sessionId && (P.optionsByStep[s.step] || []).length > 1 && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => P.setSwapIndex(i)}
                              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Swap
                            </motion.button>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                  {/* Service reminders from the questionnaire */}
                  {deriveServiceNotes(P.userPrefs).length > 0 && (
                    <div className="mt-8 glass rounded-2xl p-5 border border-brand/20">
                      <p className="text-sm font-semibold text-white mb-3">Don't forget</p>
                      <ul className="space-y-2">
                        {deriveServiceNotes(P.userPrefs).map((note) => (
                          <li key={note} className="text-sm text-foreground/85">
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-10">
                    <GlowButton
                      onClick={() => {
                        P.setPage("home");
                        P.setSessionId(null);
                        P.setSelectedChain([]);
                      }}
                      size="lg"
                      className="w-full"
                    >
                      <Rocket className="w-5 h-5" /> Plan another meetup
                    </GlowButton>
                    <GlowButton variant="ghost" onClick={() => window.print()} size="lg" className="w-full">
                      <Printer className="w-5 h-5" /> Print / Save
                    </GlowButton>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Map display */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="glass-strong rounded-3xl overflow-hidden border border-white/10"
              >
                <MapPlanner
                  options={[]}
                  selectedChain={P.selectedChain}
                  onSelect={() => {}}
                  onPreview={(place) => {
                    if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                  }}
                  highlightedPlace={P.highlightedPlace}
                />
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Swap-a-stop modal: pick an alternative for one itinerary stop */}
      <AnimatePresence>
        {P.swapIndex != null && P.selectedChain[P.swapIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
            onClick={() => P.setSwapIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/10"
            >
              <div className="p-6 pb-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Swap {humanStepName(P.selectedChain[P.swapIndex].step).toLowerCase()}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Currently: {P.selectedChain[P.swapIndex].place.title}
                    {P.swapIndex < P.selectedChain.length - 1 && " · later stops will refresh"}
                  </p>
                </div>
                <button
                  onClick={() => P.setSwapIndex(null)}
                  aria-label="Close"
                  className="p-2 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-2">
                {(P.optionsByStep[P.selectedChain[P.swapIndex].step] || [])
                  .filter(
                    (o) =>
                      (o.place_id || o.title) !==
                      (P.selectedChain[P.swapIndex].place.place_id || P.selectedChain[P.swapIndex].place.title)
                  )
                  .slice(0, 8)
                  .map((o, i) => (
                    <motion.button
                      key={o.place_id || `${o.title}-${i}`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => P.swapStop(P.swapIndex, o)}
                      className="w-full text-left glass rounded-xl p-4 hover:bg-white/10 hover:border-brand/40 border border-transparent transition-all cursor-pointer flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{o.title || o.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{o.address}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        {o.rating && (
                          <span className="text-yellow-400 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400" /> {o.rating}
                          </span>
                        )}
                        {o.distance_meters != null && (
                          <span className="text-brand-3 text-xs">
                            {o.distance_meters < 1000
                              ? `${Math.round(o.distance_meters)} m`
                              : `${(o.distance_meters / 1000).toFixed(1)} km`}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-page overlay shown while switching steps / auto-planning */}
      <FullOverlay show={P.showOverlay} text={P.overlayText} />
    </div>
  );
}
