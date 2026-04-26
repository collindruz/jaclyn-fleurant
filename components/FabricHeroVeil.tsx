/**
 * Soft white veil: radial + linear white stacks, 2px backdrop blur, linen weave sibling — no grey/black overlay.
 */
export function FabricHeroVeil() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{
        background: [
          "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.68), transparent 42%)",
          "linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0.16), rgba(255,255,255,0))",
        ].join(", "),
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }}
      aria-hidden
    />
  );
}

export function LinenWeave() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] mix-blend-screen opacity-[0.035]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cpath d='M0 60h120M60 0v120' fill='none' stroke='%23ffffff' stroke-width='0.6' stroke-opacity='0.4'/%3E%3Cpath d='M0 0l120 120M120 0L0 120' fill='none' stroke='%23ffffff' stroke-width='0.25' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
        backgroundSize: "120px 120px",
      }}
      aria-hidden
    />
  );
}
