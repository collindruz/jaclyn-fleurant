"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type HeroImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
};

export function HeroImage({ src, alt, priority }: HeroImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 32]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.58]);

  return (
    <div ref={ref} className="absolute inset-0 z-0">
      <motion.div className="absolute inset-0" style={reduce ? undefined : { y, opacity }}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover"
          sizes="100vw"
        />
      </motion.div>
    </div>
  );
}
