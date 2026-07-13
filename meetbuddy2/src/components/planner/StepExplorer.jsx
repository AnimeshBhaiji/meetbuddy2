// src/components/planner/StepExplorer.jsx
// Map-first step page: full-viewport map, floating controls, bottom option
// carousel, and a collapsed "view all options" card grid below the map.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, ArrowLeft, ArrowRight, X, Star, ExternalLink, Check,
  RotateCcw, ChevronDown, ChevronUp, AlertTriangle, SlidersHorizontal,
} from "lucide-react";
import MapPlanner from "@/components/MapPlanner";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";
import { STEP_EMOJI, humanStepName, applyFiltersAndSort } from "@/hooks/usePlannerSession";

// Inline error banner (dark destructive style)
export function ErrorBanner({ message }) {
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

// Compact option card for the floating bottom carousel
function CarouselCard({ o, idx, pickBadge, onSelect, onHighlight, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.05, 0.4) }}
      onMouseEnter={() => onHighlight(o)}
      onMouseLeave={() => onHighlight(null)}
      className="snap-start shrink-0 w-64 glass-strong rounded-2xl border border-white/10 hover:border-brand/50 transition-colors overflow-hidden"
    >
      {o.thumbnail && (
        <div className="h-20 overflow-hidden relative">
          <img src={o.thumbnail} alt={o.title} className="w-full h-full object-cover" />
          {pickBadge && idx === 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r from-brand to-brand-2">
              ⭐ MeetBuddy's pick
            </span>
          )}
        </div>
      )}
      <div className="p-3">
        {!o.thumbnail && pickBadge && idx === 0 && (
          <span className="inline-block mb-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r from-brand to-brand-2">
            ⭐ MeetBuddy's pick
          </span>
        )}
        <p className="font-semibold text-sm text-white line-clamp-1">{o.title || o.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{o.address}</p>
        <div className="flex items-center gap-2.5 mt-1.5 text-xs">
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
        <div className="flex gap-1.5 mt-2.5">
          <button
            onClick={() => onSelect(o)}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gradient-to-r from-brand to-brand-2 text-white rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> Select
          </button>
          {o.link && (
            <button
              onClick={() => window.open(o.link, "_blank", "noopener,noreferrer")}
              className="px-2 py-1.5 glass rounded-lg text-xs cursor-pointer hover:bg-white/10"
              aria-label="Open in Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function StepExplorer({ P }) {
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [showControls, setShowControls] = useState(false); // filter/sort + step editor popover
  const {
    currentStep, stepOptions, initialFlow, planMode, directives, anchorText,
    selectedChain, sessionLoading, plannerError, highlightedPlace, setHighlightedPlace,
    activeFilters, setActiveFilters, sortBy, setSortBy, showAllOptions, setShowAllOptions,
    upcomingSteps, removeUpcomingStep, addUpcomingStep, moveUpcomingStep,
    selectOption, goBackOneStep, skipStep, startSession, setPage, setSessionId, setSelectedChain,
  } = P;

  const shortlist = planMode === "semi" ? directives?.shortlist : null;
  let displayedOptions = shortlist && !showAllOptions ? stepOptions.slice(0, shortlist) : stepOptions;
  if (planMode === "full") displayedOptions = applyFiltersAndSort(displayedOptions, activeFilters, sortBy);
  const filterChips = planMode === "full" ? directives?.filters || [] : [];
  const currentIdx = initialFlow.indexOf(currentStep);

  const cancel = () => { setPage("home"); setSessionId(null); setSelectedChain([]); };

  return (
    <div className="max-w-none">
      {/* ------- full-viewport map stage ------- */}
      <div className="relative h-[calc(100vh-7rem)] min-h-[480px]">
        <MapPlanner
          className="absolute inset-0"
          options={displayedOptions}
          selectedChain={selectedChain}
          onSelect={selectOption}
          highlightedPlace={highlightedPlace}
        />

        {/* floating top bar */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex items-start justify-between gap-3 pointer-events-none">
          <div className="glass-strong rounded-2xl px-4 py-3 border border-white/10 pointer-events-auto max-w-[70%]">
            <div className="flex items-center gap-2 flex-wrap">
              {initialFlow.map((step, i) => (
                <span
                  key={step}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    i === currentIdx
                      ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50"
                      : i < currentIdx
                      ? "glass text-brand-3 border border-brand/25"
                      : "glass text-muted-foreground"
                  }`}
                >
                  {i < currentIdx ? <Check className="w-3 h-3" /> : <span>{STEP_EMOJI[step] ?? "📍"}</span>}
                  {humanStepName(step)}
                </span>
              ))}
              <span className="glass px-2.5 py-1 rounded-full text-[10px] font-medium text-brand-3 border border-brand/25">
                {planMode === "full" ? "🎛️ Full control" : "🎨 Guided"}
              </span>
            </div>
            {anchorText && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand-3" /> {anchorText}
              </p>
            )}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {planMode === "full" && (
              <GlowButton variant="ghost" onClick={() => setShowControls((s) => !s)} aria-label="Filters and steps">
                <SlidersHorizontal className="w-4 h-4" />
              </GlowButton>
            )}
            <GlowButton variant="ghost" onClick={goBackOneStep}>
              <ArrowLeft className="w-4 h-4" /> Back
            </GlowButton>
            {planMode === "full" && (
              <GlowButton variant="ghost" onClick={skipStep}>
                Skip <ArrowRight className="w-4 h-4" />
              </GlowButton>
            )}
            <GlowButton variant="danger" onClick={cancel} aria-label="Cancel planning">
              <X className="w-4 h-4" />
            </GlowButton>
          </div>
        </div>

        {/* full-control popover: filter chips + sort + upcoming-step editor */}
        <AnimatePresence>
          {planMode === "full" && showControls && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-24 right-4 z-[1000] glass-strong rounded-2xl p-5 border border-white/10 w-80 max-h-[60vh] overflow-y-auto"
            >
              {/* filter chips + sort pills: markup moved verbatim from Planner.jsx lines 1048-1088 */}
              {stepOptions.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold text-white mb-3">Filters &amp; sort</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {filterChips.map((f) => {
                      const active = activeFilters.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() =>
                            setActiveFilters((cur) =>
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
                        onClick={() => setSortBy(key)}
                        className={`px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 ${
                          sortBy === key
                            ? "glass text-white border border-white/25"
                            : "text-muted-foreground hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* upcoming-step editor: markup moved verbatim from Planner.jsx lines 992-1042 */}
              <div>
                <p className="text-sm font-semibold text-white mb-3">
                  Upcoming steps <span className="text-muted-foreground font-normal">(current step anchors your plan)</span>
                </p>
                {upcomingSteps.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">No steps after this one.</p>
                )}
                <div className="space-y-2 mb-4">
                  {upcomingSteps.map((s, i) => (
                    <div key={s} className="flex items-center gap-3 glass rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-sm text-white">
                        {STEP_EMOJI[s]} {humanStepName(s)}
                      </span>
                      <button
                        onClick={() => moveUpcomingStep(s, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveUpcomingStep(s, 1)}
                        disabled={i === upcomingSteps.length - 1}
                        aria-label="Move down"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeUpcomingStep(s)}
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
                    .filter((s) => !initialFlow.includes(s))
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => addUpcomingStep(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        + {STEP_EMOJI[s]} {humanStepName(s)}
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* shortlist banner (semi mode) */}
        {shortlist && stepOptions.length > shortlist && (
          <div className="absolute bottom-44 left-4 z-[1000] glass-strong rounded-xl px-4 py-2 border border-brand/20 text-xs text-muted-foreground">
            {showAllOptions ? `All ${stepOptions.length} options` : `✨ Top ${Math.min(shortlist, stepOptions.length)} picks`}
            <button
              onClick={() => setShowAllOptions((s) => !s)}
              className="ml-2 font-medium text-brand-3 hover:text-white cursor-pointer"
            >
              {showAllOptions ? "Back to shortlist" : "Show all"}
            </button>
          </div>
        )}

        {/* bottom option carousel */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="mb-2"><ErrorBanner message={plannerError} /></div>
          {displayedOptions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto snap-x pb-2">
              {displayedOptions.map((o, idx) => (
                <CarouselCard
                  key={o.place_id || `${o.title}-${idx}`}
                  o={o} idx={idx}
                  pickBadge={planMode === "semi" && !showAllOptions}
                  onSelect={selectOption}
                  onHighlight={setHighlightedPlace}
                  loading={sessionLoading}
                />
              ))}
            </div>
          ) : (
            <GlassCard variant="strong" className="p-6 text-center">
              <p className="text-sm text-foreground/85 mb-3">
                {stepOptions.length > 0 ? "No venues match your filters." : "😅 No options for this step."}
              </p>
              {stepOptions.length > 0 ? (
                <GlowButton variant="ghost" onClick={() => setActiveFilters([])}>Clear filters</GlowButton>
              ) : (
                <div className="flex justify-center gap-3">
                  <GlowButton onClick={startSession}><RotateCcw className="w-4 h-4" /> Retry</GlowButton>
                  <GlowButton variant="ghost" onClick={cancel}><ArrowLeft className="w-4 h-4" /> Go back</GlowButton>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* ------- collapsed "view all options" grid below the map ------- */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <button
          onClick={() => setShowAllGrid((s) => !s)}
          className="w-full flex items-center justify-center gap-2 glass rounded-2xl py-3 text-sm font-medium text-brand-3 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {showAllGrid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showAllGrid ? "Hide detailed cards" : `View all ${displayedOptions.length} options as cards`}
        </button>
        <AnimatePresence>
          {showAllGrid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-5"
            >
              <StepGrid
                options={displayedOptions}
                pickBadge={planMode === "semi" && !showAllOptions}
                onSelect={selectOption}
                loading={sessionLoading}
                onHighlight={setHighlightedPlace}
                onRetry={startSession}
                onBack={cancel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
