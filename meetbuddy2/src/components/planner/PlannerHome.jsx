// src/components/planner/PlannerHome.jsx
import { motion } from "framer-motion";
import { MapPin, LocateFixed, Rocket } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import { PREF_META } from "@/hooks/usePlannerSession";
import { ErrorBanner } from "./StepExplorer";

const displayPref = (val) => {
  if (!val) return "—";
  return Array.isArray(val) ? val.join(", ") : String(val);
};

export default function PlannerHome({ P }) {
  const {
    userPrefs, placeText, setPlaceText, coords, locLoading, useMyLocation,
    handlePlaceTextBlur, flowText, plannerError, startSession, sessionLoading,
  } = P;
  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Plan your perfect <span className="text-gradient">meetup</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Personalized recommendations based on your preferences
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard variant="gradient" className="p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-10 mb-8">
            {/* Preferences display */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-5">Your preferences</h2>
              <div className="space-y-3">
                {PREF_META.map(({ key, label, emoji }) => (
                  <div
                    key={key}
                    className="flex items-center gap-3.5 glass rounded-xl p-3.5"
                  >
                    <span className="text-xl">{emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="font-medium text-white truncate">{displayPref(userPrefs?.[key])}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Location & flow */}
            <div className="flex flex-col gap-7">
              <div>
                <label className="block text-xl font-semibold text-white mb-4">Select location</label>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
                    <input
                      value={placeText}
                      onChange={(e) => setPlaceText(e.target.value)}
                      onBlur={handlePlaceTextBlur}
                      placeholder="Enter city or area..."
                      className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
                    />
                  </div>
                  <GlowButton onClick={useMyLocation} disabled={locLoading} aria-label="Use GPS location">
                    <LocateFixed className={`w-4.5 h-4.5 ${locLoading ? "animate-spin" : ""}`} />
                    GPS
                  </GlowButton>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-3" />
                  {coords
                    ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                    : placeText
                    ? placeText
                    : "No location set"}
                </div>
              </div>

              <div>
                <label className="block text-xl font-semibold text-white mb-4">Your planned flow</label>
                <div className="glass rounded-xl p-4 font-medium text-center border border-brand/25">
                  <span className="text-brand-3 font-semibold">{flowText || "Restaurant → Activity → Stay"}</span>
                </div>
              </div>
            </div>
          </div>

          <ErrorBanner message={plannerError} />

          {/* Action buttons */}
          <GlowButton
            onClick={startSession}
            disabled={sessionLoading || (!coords && !placeText && !(userPrefs && userPrefs.location))}
            size="lg"
            className="w-full"
          >
            {sessionLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" /> Generate itinerary
              </>
            )}
          </GlowButton>
        </GlassCard>
      </motion.div>
    </div>
  );
}
