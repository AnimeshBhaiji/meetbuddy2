// Word-level scroll reveal — one-time, transform/opacity only.
// Replaces the per-character GSAP ScrollTrigger scrub (heavy) with a cheap
// framer-motion whileInView stagger. Same API as before.
import { motion } from "framer-motion";
import { EASE, DUR, STAGGER } from "@/lib/motion";

const ScrollFloat = ({ children, containerClassName = "", textClassName = "" }) => {
  const words = (typeof children === "string" ? children : "").split(" ");
  return (
    <h2 className={containerClassName}>
      <span className={textClassName}>
        {words.map((word, i) => (
          <motion.span
            key={i}
            className="inline-block whitespace-pre"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: DUR.slow, ease: EASE, delay: i * STAGGER }}
          >
            {word}
            {" "}
          </motion.span>
        ))}
      </span>
    </h2>
  );
};

export default ScrollFloat;
