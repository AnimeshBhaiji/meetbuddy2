// src/pages/Planner.jsx
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import AmbientBackground from "@/components/AmbientBackground";
import usePlannerSession from "@/hooks/usePlannerSession";
import PlannerHome from "@/components/planner/PlannerHome";
import StepExplorer from "@/components/planner/StepExplorer";
import ItineraryCanvas from "@/components/planner/ItineraryCanvas";

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

        {/* SUMMARY PAGE: editable route canvas */}
        {P.page === "summary" && <ItineraryCanvas P={P} />}
      </div>

      {/* Full-page overlay shown while switching steps / auto-planning */}
      <FullOverlay show={P.showOverlay} text={P.overlayText} />
    </div>
  );
}
