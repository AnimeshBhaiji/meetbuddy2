// Fixed full-viewport ambient backdrop — pure CSS, no WebGL.
// Three drifting gradient sheets fake the aurora; two orbs add depth.
// All animation is transform-only (GPU-composited, ~zero main-thread cost).
// intensity: "hero" (bright, for landing/marketing) | "app" (dimmer, for functional pages)
import React from "react";

const SHEETS = [
  {
    background: "radial-gradient(ellipse 60% 70% at 25% 40%, #6d5cff59, transparent 70%)",
    animationDuration: "26s",
    animationDelay: "0s",
  },
  {
    background: "radial-gradient(ellipse 55% 65% at 60% 30%, #c44cff4d, transparent 70%)",
    animationDuration: "32s",
    animationDelay: "-9s",
  },
  {
    background: "radial-gradient(ellipse 50% 60% at 80% 50%, #3ec6ff40, transparent 70%)",
    animationDuration: "38s",
    animationDelay: "-18s",
  },
];

export default function AmbientBackground({ intensity = "app" }) {
  const isHero = intensity === "hero";
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "60vh",
          opacity: isHero ? 0.6 : 0.28,
          maskImage: "linear-gradient(to bottom, black 45%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 45%, transparent)",
        }}
      >
        {SHEETS.map((sheet, i) => (
          <div
            key={i}
            className="absolute animate-aurora-drift"
            style={{
              inset: "-30% -20%",
              filter: "blur(60px)",
              willChange: "transform",
              ...sheet,
            }}
          />
        ))}
      </div>
      <div
        className="absolute rounded-full blur-[120px] animate-float-slow"
        style={{
          width: 480,
          height: 480,
          left: "-10%",
          top: "20%",
          background: "oklch(0.45 0.18 285 / 18%)",
        }}
      />
      <div
        className="absolute rounded-full blur-[140px] animate-float-slow"
        style={{
          width: 420,
          height: 420,
          right: "-8%",
          bottom: "5%",
          background: "oklch(0.5 0.2 320 / 14%)",
          animationDelay: "-3.5s",
        }}
      />
    </div>
  );
}
