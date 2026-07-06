// Dark themed labeled input with animated focus ring and inline error
import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Field({
  label,
  error,
  icon = null,
  className = "",
  inputClassName = "",
  as = "input",
  children,
  ...rest
}) {
  const Tag = as;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </span>
        )}
        <Tag
          className={`w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07] ${icon ? "pl-11" : ""} ${error ? "border-destructive/60" : ""} ${inputClassName}`}
          {...rest}
        >
          {children}
        </Tag>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            className="text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
