"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const REDUCE_MQ = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCE_MQ).matches;
}

function reducedMotionServerSnapshot() {
  return false;
}

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    reducedMotionServerSnapshot
  );

  return (
    <div
      key={pathname}
      className={reduce ? undefined : "page-enter"}
    >
      {children}
    </div>
  );
}
