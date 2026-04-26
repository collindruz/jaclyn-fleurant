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

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-6 text-charcoal/80 sm:px-6 sm:py-7 md:px-10 md:py-8 bg-bone/60"
    >
      <Link
        href="/"
        className="font-serif text-[0.98rem] tracking-[0.18em] transition-opacity duration-1000 hover:opacity-50 sm:text-[1.05rem]"
      >
        JACLYN FLEURANT
      </Link>
      <nav className="hidden items-center gap-8 sm:gap-9 md:flex" aria-label="Main">
        {SITE_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[0.66rem] font-normal tracking-[0.08em] transition-opacity duration-1000 ${
                active ? "text-charcoal/80" : "text-charcoal/38"
              } ${active ? "" : "hover:opacity-70"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <details className="md:hidden">
        <summary className="list-none cursor-pointer text-[0.64rem] tracking-[0.1em] text-current/70">
          Index
        </summary>
        <div
          className="absolute right-5 top-[3.5rem] flex min-w-[10rem] flex-col gap-4 border border-charcoal/[0.08] bg-bone/98 p-4 text-left text-[0.64rem] tracking-[0.06em] text-charcoal/80"
        >
          {SITE_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-opacity duration-700 hover:opacity-55">
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </header>
  );
}
