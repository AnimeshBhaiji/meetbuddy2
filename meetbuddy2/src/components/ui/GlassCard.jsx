// Reusable glass surface. variant: "default" | "strong" | "gradient"
import React from "react";
import { motion } from "framer-motion";

const VARIANT_CLASS = {
  default: "glass",
  strong: "glass-strong",
  gradient: "border-gradient glass-strong",
};

export default function GlassCard({
  children,
  className = "",
  variant = "default",
  hover = false,
  ...rest
}) {
  return (
    <motion.div
      whileHover={
        hover
          ? { y: -6, boxShadow: "0 20px 50px oklch(0.62 0.22 285 / 25%)" }
          : undefined
      }
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`rounded-2xl ${VARIANT_CLASS[variant] ?? VARIANT_CLASS.default} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
