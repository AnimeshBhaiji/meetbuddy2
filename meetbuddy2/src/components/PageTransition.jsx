// Route-level enter/exit wrapper. Used by App.jsx around each page element.
import React from "react";
import { motion } from "framer-motion";

// transform/opacity only — animating filter forces full-page repaints
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.12, ease: "easeIn" },
  },
};

export default function PageTransition({ children }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}
