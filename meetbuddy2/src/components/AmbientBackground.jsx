// Fixed full-viewport ambient backdrop: brand Aurora + drifting gradient orbs.
// intensity: "hero" (bright, for landing/marketing) | "app" (dimmer, for functional pages)
import React from "react";
import Aurora from "./Aurora";

const BRAND_STOPS = ["#6d5cff", "#c44cff", "#3ec6ff"];

export default function AmbientBackground({ intensity = "app" }) {
  const isHero = intensity === "hero";
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "60vh",
          opacity: isHero ? 0.65 : 0.3,
          maskImage: "linear-gradient(to bottom, black 55%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
        }}
      >
        <Aurora colorStops={BRAND_STOPS} amplitude={isHero ? 1.2 : 0.8} blend={0.6} />
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
