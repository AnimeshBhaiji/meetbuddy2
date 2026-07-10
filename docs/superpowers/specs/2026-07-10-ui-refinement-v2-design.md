# MeetBuddy UI Refinement v2 — Design Spec

**Date:** 2026-07-10
**Base:** `feat/questionnaire-driven-planner` (PR #3 code)
**Approach approved by user:** Evolve the dark glassmorphism look — performance-first refinement on all pages, plus a deeper "wow" rework of the landing page only.

## User requirements (from Q&A)

1. **Direction:** Evolve the current dark glass aesthetic. No new visual identity.
2. **Performance:** The app lags today. Audit every animation aggressively; keep only GPU-cheap ones (transform/opacity). This is a hard requirement, not a nice-to-have.
3. **Navigation:** Keep the top glass navbar; polish it (it already has the sliding active pill and scroll shrink).
4. **Readability:** Low-contrast body text is the main complaint. Fix muted text contrast to WCAG AA everywhere.
5. **Process:** Task list, journey order, move to next task only at ≥85% complete, verified.

## Design intelligence inputs (ui-ux-pro-max database)

- Current Liquid-Glass-style approach is rated "Performance: Moderate-Poor" — matches observed lag.
- Target profile "Modern Dark Cinema": CSS ambient blobs instead of WebGL, hairline borders `rgba(255,255,255,0.08)`, bright body text (`#EDEDEF`-class), muted ≥3:1, single easing `cubic-bezier(0.16,1,0.3,1)`, micro-interactions 150–300ms, press scale 0.97, transform/opacity only.
- Key UX rules applied: `transform-performance`, `excessive-motion` (1–2 animated elements per view), `stagger-sequence` (30–50ms), `exit-faster-than-enter`, `reduced-motion`, `color-accessible-pairs` (4.5:1 body, 3:1 secondary), `contrast-readability`, `nav-state-active`, `main-thread-budget` (16ms/frame).

## 1. Motion system (foundation)

New CSS tokens in `index.css`, consumed everywhere:

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--dur-fast: 150ms;   /* micro: hover, press */
--dur-med: 250ms;    /* component transitions */
--dur-slow: 400ms;   /* page-level, hero reveals */
```

Rules:
- Transform + opacity only. Nothing animates blur, box-shadow, width/height, or layout.
- List/grid entrances stagger at 40ms/item, `viewport={{ once: true }}`.
- Exits run at ~70% of enter duration.
- Global `prefers-reduced-motion: reduce` block disables non-essential motion (framer-motion `useReducedMotion` where needed, CSS media query for keyframe animations).
- Press feedback: scale 0.97 on tappable cards/buttons.

## 2. Performance surgery

| Problem | Fix |
|---|---|
| WebGL Aurora (OGL) shader renders continuously on every page | Delete `Aurora.jsx` + `ogl` dependency. `AmbientBackground` becomes pure CSS: layered static radial gradients + two drifting orbs (transform-only keyframes, `will-change: transform`). Same hero/app intensity prop. |
| `ScrollFloat` splits headings into per-character GSAP ScrollTrigger tweens | Replace with one-time word-level fade-rise (framer-motion `whileInView`, once). Remove GSAP + ScrollTrigger deps if nothing else uses them. |
| `MagicBento/MagicCard` per-mousemove React state | CSS-only hover treatment (or delete if unused after landing rework). |
| Nested glass-in-glass backdrop-filter layers | Glass utilities only on top-level containers; inner elements use flat translucent backgrounds without backdrop-filter. |
| Landing renders everything upfront | `content-visibility: auto` on below-fold sections. |

Definition of "not laggy": with the page idle, DevTools performance shows no continuous per-frame work; scroll and hover stay smooth (no long tasks from animation).

## 3. Readability

- `--muted-foreground`: `oklch(0.65 0.02 270)` → `oklch(0.75 0.02 270)` (≥4.5:1 on background and card surfaces). Single-token change fixes every page.
- Body text minimum 15–16px; line-height ~1.6 in cards and forms.
- `text-gradient` allowed only on: landing hero headline + at most one heading per page. No glow effects below heading size.
- Spot-verify contrast on glass surfaces (token sits on translucent backgrounds).

## 4. Navigation polish (small)

- Inactive nav links: brighter than muted-gray (readable at a glance).
- Replace hover scale-jiggle on nav links with background-tint hover.
- Mobile menu: scrim behind the sheet; auto-close on route change.
- Keep: sliding `layoutId` pill, scroll-aware shrink, logo, CTA.

## 5. Landing page "wow" (only deep rework)

- **Hero:** staggered word-level headline reveal (one-time), scroll-linked subtle parallax on hero visual (framer-motion `useScroll` + transform), magnetic primary CTA (cheap transform on pointermove over the button only).
- **Features → bento grid:** mixed-size glass tiles, staggered scroll-in, one large showcase tile containing an animated mini-itinerary mock (pure CSS animation).
- **How it works:** CSS `position: sticky` step-scroll section — steps pin and swap on scroll without ScrollTrigger.
- **Closing CTA band:** gradient-border glass band above the footer.
- Copy may be tightened; tone stays.

## 6. Per-page refinement pass (journey order)

Landing → Signup → Login → Questionnaire Stage 1 → Stage 2 → Summary → Home → Planner → Calendar → Profile → About.

Each page gets: motion-token migration, contrast/type fixes, heavy-effect removal, spacing tidy. **No layout changes outside the landing.** Planner behavior (3 modes, swap, filters, skip) must not regress.

## 7. Verification (85% gate per task)

- Every task: `npm run lint` clean + Playwright screenshot of the affected page(s).
- Performance tasks: verify no continuous animation work when idle (Playwright + CDP or manual trace).
- Reduced-motion smoke test once the motion system lands.
- Final: re-run the 15-check 3-mode planner E2E matrix; `npm run build` passes.

## Out of scope

- Backend changes of any kind.
- Layout redesigns on non-landing pages.
- Light theme / theming system.
- New dependencies (the work removes `ogl`, possibly `gsap`).
