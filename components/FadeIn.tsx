"use client";

import { motion, useReducedMotion } from "framer-motion";

type FadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Longer, softer reveal for still-life pages. */
  slow?: boolean;
};

export function FadeIn({ children, className, delay = 0, slow = false }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: slow ? 8 : 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0% 0px -18% 0px", amount: 0.08 }}
      transition={{
        duration: slow ? 1.85 : 1.25,
        delay,
        ease: [0.2, 1, 0.35, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
