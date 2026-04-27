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
    `whitespace-nowrap text-[0.66rem] font-normal tracking-[0.08em] transition-opacity duration-1000 ${
      active ? "text-charcoal/80" : "text-charcoal/38"
    } ${active ? "" : "hover:opacity-70"}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-4 bg-bone/60 px-5 py-5 text-charcoal/80 sm:gap-5 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between md:gap-0 md:px-10 md:py-8">
      <Link
        href="/"
        className="w-max font-serif text-[0.98rem] tracking-[0.18em] transition-opacity duration-1000 hover:opacity-50 sm:text-[1.05rem]"
      >
        JACLYN FLEURANT
      </Link>
      <nav
        className="flex w-full min-w-0 flex-row flex-nowrap items-baseline justify-between gap-x-1 sm:gap-x-2 md:w-auto md:justify-end md:gap-8"
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
