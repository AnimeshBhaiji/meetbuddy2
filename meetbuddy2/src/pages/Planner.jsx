// src/pages/Planner.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  LocateFixed,
  Rocket,
  ArrowLeft,
  ArrowRight,
  X,
  Star,
  ExternalLink,
  Check,
  RotateCcw,
  Printer,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";
import Navbar from "../components/Navbar";
import MapPlanner from "../components/MapPlanner";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import usePlannerSession, {
  PREF_META,
  STEP_EMOJI,
  FILTER_MATCHERS,
  deriveServiceNotes,
  applyFiltersAndSort,
  humanStepName,
} from "@/hooks/usePlannerSession";

// Inline error banner (dark destructive style)
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-red-300 rounded-xl text-sm flex items-center gap-3"
    >
      <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400" />
      {message}
    </motion.div>
  );
}

// UI: grid of cards for the step
function StepGrid({ options = [], onSelect, loading, onHighlight, onRetry, onBack, pickBadge = false }) {
  if (!options || options.length === 0) {
    return (
      <GlassCard variant="strong" className="p-12 text-center">
        <div className="mb-6">
          <p className="text-lg text-foreground/85 mb-2">😅 No options available for this step.</p>
          <p className="text-muted-foreground">Try adjusting your location or preferences.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          {onRetry && (
            <GlowButton onClick={onRetry}>
              <RotateCcw className="w-4.5 h-4.5" /> Retry
            </GlowButton>
          )}
          {onBack && (
            <GlowButton variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4.5 h-4.5" /> Go back
            </GlowButton>
          )}
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {options.map((o, idx) => (
        <motion.div
          key={o.place_id || `${o.title ?? ""}::${o.address ?? ""}::${idx}`}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6 }}
          className="relative glass-strong rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand/50 hover:glow-sm transition-all duration-300 group"
          onMouseEnter={() => {
            if (onHighlight) onHighlight(o);
          }}
          onMouseLeave={() => {
            if (onHighlight) onHighlight(null);
          }}
        >
          {pickBadge && idx === 0 && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-brand to-brand-2 glow-sm">
              ⭐ MeetBuddy's pick
            </span>
          )}
          {/* Thumbnail */}
          {o.thumbnail && (
            <div className="w-full h-40 bg-gradient-to-br from-brand/15 to-brand-2/15 overflow-hidden relative">
              <img
                src={o.thumbnail}
                alt={o.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              {o.rating && (
                <span className="absolute top-3 right-3 glass-strong px-2.5 py-1 rounded-lg text-sm font-semibold text-yellow-400 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400" /> {o.rating}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-5">
            <div className="flex justify-between items-start gap-2 mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-lg text-white line-clamp-2">
                  {o.title || o.name || "Unnamed Place"}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{o.address}</p>
                {o.distance_meters != null && (
                  <p className="text-xs text-brand-3 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {o.distance_meters < 1000
                      ? `${Math.round(o.distance_meters)} m away`
                      : `${(o.distance_meters / 1000).toFixed(1)} km away`}
                  </p>
                )}
              </div>
              {!o.thumbnail && o.rating && (
                <div className="text-base font-semibold text-yellow-400 flex-shrink-0 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400" /> {o.rating}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-3 border-t border-white/10">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(o);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-brand to-brand-2 text-white rounded-lg font-medium text-sm glow-sm hover:glow-md transition-shadow duration-300 cursor-pointer disabled:opacity-50"
                disabled={loading}
              >
                <Check className="w-4 h-4" /> Select
              </motion.button>
              {o.link && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(o.link, "_blank", "noopener,noreferrer");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 glass text-foreground/85 rounded-lg hover:bg-white/10 hover:text-white transition font-medium text-sm cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" /> Open
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

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

// Flow stepper pills shown on the step page
function FlowStepper({ flow, currentStep, humanStepName }) {
  if (!flow || flow.length === 0) return null;
  const currentIdx = flow.indexOf(currentStep);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      {flow.map((step, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentIdx === i;
        return (
          <React.Fragment key={step}>
            {i > 0 && <span className="text-muted-foreground/50 text-sm">→</span>}
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isCurrent
                  ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50 glow-sm"
                  : isDone
                  ? "glass text-brand-3 border border-brand/25"
                  : "glass text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="w-3.5 h-3.5" /> : <span>{STEP_EMOJI[step] ?? "📍"}</span>}
              {humanStepName(step)}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Planner() {
  const P = usePlannerSession();

  const displayPref = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />

      <div className="min-h-screen pt-28 pb-16">
        {/* HOME / preferences panel */}
        {P.page === "home" && (
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
                            <p className="font-medium text-white truncate">{displayPref(P.userPrefs?.[key])}</p>
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
                            value={P.placeText}
                            onChange={(e) => P.setPlaceText(e.target.value)}
                            onBlur={P.handlePlaceTextBlur}
                            placeholder="Enter city or area..."
                            className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
                          />
                        </div>
                        <GlowButton onClick={P.useMyLocation} disabled={P.locLoading} aria-label="Use GPS location">
                          <LocateFixed className={`w-4.5 h-4.5 ${P.locLoading ? "animate-spin" : ""}`} />
                          GPS
                        </GlowButton>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-3" />
                        {P.coords
                          ? `${P.coords.lat.toFixed(4)}, ${P.coords.lng.toFixed(4)}`
                          : P.placeText
                          ? P.placeText
                          : "No location set"}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xl font-semibold text-white mb-4">Your planned flow</label>
                      <div className="glass rounded-xl p-4 font-medium text-center border border-brand/25">
                        <span className="text-brand-3 font-semibold">{P.flowText || "Restaurant → Activity → Stay"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ErrorBanner message={P.plannerError} />

                {/* Action buttons */}
                <GlowButton
                  onClick={P.startSession}
                  disabled={P.sessionLoading || (!P.coords && !P.placeText && !(P.userPrefs && P.userPrefs.location))}
                  size="lg"
                  className="w-full"
                >
                  {P.sessionLoading ? (
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
        )}

        {/* STEP PAGE: show all options for current step */}
        {P.page === "step" && (() => {
          // Semi-custom "shortlist 3–5": trim to the top picks unless expanded
          const shortlist = P.planMode === "semi" ? P.directives?.shortlist : null;
          let displayedOptions =
            shortlist && !P.showAllOptions ? P.stepOptions.slice(0, shortlist) : P.stepOptions;
          // Full control: apply filter chips + sort
          if (P.planMode === "full") {
            displayedOptions = applyFiltersAndSort(displayedOptions, P.activeFilters, P.sortBy);
          }
          const filterChips = P.planMode === "full" ? P.directives?.filters || [] : [];
          return (
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl md:text-5xl font-bold text-gradient">
                    {P.currentStep ? humanStepName(P.currentStep) : "Done"}
                  </h1>
                  <span className="glass px-3 py-1 rounded-full text-xs font-medium text-brand-3 border border-brand/25">
                    {P.planMode === "full" ? "🎛️ Full control" : "🎨 Guided"} mode
                  </span>
                </div>
                {P.anchorText && (
                  <p className="text-muted-foreground mt-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-brand-3" /> {P.anchorText}
                  </p>
                )}
              </motion.div>
              <div className="flex gap-3 shrink-0 flex-wrap">
                <GlowButton variant="ghost" onClick={P.goBackOneStep}>
                  <ArrowLeft className="w-4.5 h-4.5" /> Back
                </GlowButton>
                {P.planMode === "full" && (
                  <GlowButton variant="ghost" onClick={P.skipStep}>
                    Skip step <ArrowRight className="w-4.5 h-4.5" />
                  </GlowButton>
                )}
                <GlowButton
                  variant="danger"
                  onClick={() => {
                    P.setPage("home");
                    P.setSessionId(null);
                    P.setSelectedChain([]);
                  }}
                >
                  <X className="w-4.5 h-4.5" /> Cancel
                </GlowButton>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <FlowStepper flow={P.initialFlow} currentStep={P.currentStep} humanStepName={humanStepName} />
              {P.planMode === "full" && P.upcomingSteps.length >= 0 && (
                <button
                  onClick={() => P.setShowStepEditor((s) => !s)}
                  className="mb-8 inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  ⚙️ Edit steps
                </button>
              )}
            </div>

            {/* Full-control step editor: manage upcoming steps */}
            {P.planMode === "full" && P.showStepEditor && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 glass rounded-2xl p-5 border border-brand/20"
              >
                <p className="text-sm font-semibold text-white mb-3">
                  Upcoming steps <span className="text-muted-foreground font-normal">(current step anchors your plan)</span>
                </p>
                {P.upcomingSteps.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">No steps after this one.</p>
                )}
                <div className="space-y-2 mb-4">
                  {P.upcomingSteps.map((s, i) => (
                    <div key={s} className="flex items-center gap-3 glass rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-sm text-white">
                        {STEP_EMOJI[s]} {humanStepName(s)}
                      </span>
                      <button
                        onClick={() => P.moveUpcomingStep(s, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => P.moveUpcomingStep(s, 1)}
                        disabled={i === P.upcomingSteps.length - 1}
                        aria-label="Move down"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => P.removeUpcomingStep(s)}
                        aria-label={`Remove ${s}`}
                        className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {["restaurant", "activity", "stay"]
                    .filter((s) => !P.initialFlow.includes(s))
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => P.addUpcomingStep(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        + {STEP_EMOJI[s]} {humanStepName(s)}
                      </button>
                    ))}
                </div>
              </motion.div>
            )}

            {/* Full-control filter chips + sort */}
            {P.planMode === "full" && P.stepOptions.length > 0 && (
              <div className="mb-6 flex items-center gap-2 flex-wrap">
                {filterChips.map((f) => {
                  const active = P.activeFilters.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() =>
                        P.setActiveFilters((cur) =>
                          cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50 glow-sm"
                          : "glass text-foreground/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-brand-3" />}
                      {f}
                    </button>
                  );
                })}
                <span className="mx-1 h-5 w-px bg-white/15" />
                {[
                  ["match", "Best match"],
                  ["rating", "Top rated"],
                  ["distance", "Nearest"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => P.setSortBy(key)}
                    className={`px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 ${
                      P.sortBy === key
                        ? "glass text-white border border-white/25"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <ErrorBanner message={P.plannerError} />

            {/* Map display */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8 glass-strong rounded-3xl overflow-hidden border border-white/10"
            >
              <MapPlanner
                options={displayedOptions}
                selectedChain={P.selectedChain}
                onSelect={P.selectOption}
                onPreview={(place) => {
                  if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                }}
                highlightedPlace={P.highlightedPlace}
              />
            </motion.div>

            {/* Shortlist banner + escape hatch */}
            {shortlist && P.stepOptions.length > shortlist && (
              <div className="mb-6 flex items-center justify-between gap-4 glass rounded-2xl px-5 py-3.5 border border-brand/20">
                <p className="text-sm text-muted-foreground">
                  {P.showAllOptions
                    ? `Showing all ${P.stepOptions.length} options`
                    : `✨ Shortlisted the top ${Math.min(shortlist, P.stepOptions.length)} picks for you`}
                </p>
                <button
                  onClick={() => P.setShowAllOptions((s) => !s)}
                  className="shrink-0 text-sm font-medium text-brand-3 hover:text-white transition-colors cursor-pointer"
                >
                  {P.showAllOptions ? "Back to shortlist" : `Show all ${P.stepOptions.length}`}
                </button>
              </div>
            )}

            {P.planMode === "full" && displayedOptions.length === 0 && P.stepOptions.length > 0 ? (
              <GlassCard variant="strong" className="p-10 text-center">
                <p className="text-foreground/85 mb-5">No venues match your active filters.</p>
                <GlowButton variant="ghost" onClick={() => P.setActiveFilters([])}>
                  Clear filters
                </GlowButton>
              </GlassCard>
            ) : (
              <StepGrid
                options={displayedOptions}
                pickBadge={P.planMode === "semi" && !P.showAllOptions}
                onSelect={P.selectOption}
                loading={P.sessionLoading}
                onHighlight={P.setHighlightedPlace}
                onRetry={P.startSession}
                onBack={() => {
                  P.setPage("home");
                  P.setSessionId(null);
                }}
              />
            )}
          </div>
          );
        })()}

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
