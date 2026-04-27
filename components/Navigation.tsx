"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAV } from "@/lib/site-nav";

export function Navigation() {
  const pathname = usePathname();
  if (pathname === "/") {
    return (
      <a href="#main" className="sr-only">
        JACLYN FLEURANT — home
      </a>
    );
  }

  const linkClass = (active: boolean) =>
    `text-[0.66rem] font-normal tracking-[0.08em] transition-opacity duration-1000 ${
      active ? "text-charcoal/80" : "text-charcoal/38"
    } ${active ? "" : "hover:opacity-70"}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-row items-start justify-between gap-3 bg-bone/60 px-5 py-6 text-charcoal/80 sm:gap-4 sm:px-6 sm:py-7 md:items-center md:justify-between md:gap-0 md:px-10 md:py-8">
      <Link
        href="/"
        className="min-w-0 shrink font-serif text-[0.98rem] tracking-[0.18em] transition-opacity duration-1000 hover:opacity-50 sm:text-[1.05rem]"
      >
        JACLYN FLEURANT
      </Link>
      <nav
        className="flex shrink-0 flex-col items-end gap-3 sm:gap-3.5 md:w-auto md:flex-row md:items-center md:gap-8 md:gap-9"
        aria-label="Main"
      >
        {SITE_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(active)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
