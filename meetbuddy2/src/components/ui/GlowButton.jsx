// Button with brand glow. variant: "primary" | "ghost" | "danger"; size: "sm" | "md" | "lg"
import React from "react";
import { motion } from "framer-motion";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-brand to-brand-2 text-white glow-sm hover:glow-md",
  ghost:
    "glass text-foreground hover:bg-white/10",
  danger:
    "bg-destructive/15 border border-destructive/40 text-red-300 hover:bg-destructive/25",
};

const SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export default function GlowButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
  disabled = false,
  ...rest
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-shadow duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
