// Shared motion tokens — mirrors --ease-out / --dur-* in index.css.
// All animation in the app uses these; transform + opacity only.
export const EASE = [0.16, 1, 0.3, 1];
export const DUR = { fast: 0.15, med: 0.25, slow: 0.4 };
export const STAGGER = 0.04;

// One-time fade-rise for scroll reveals: <motion.div {...fadeRise(i)} />
export const fadeRise = (index = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: DUR.slow, ease: EASE, delay: index * STAGGER },
});

// Press feedback for tappable cards/buttons
export const press = { whileTap: { scale: 0.97 } };
