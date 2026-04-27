/**
 * Interior routes only: top padding so content sits below the fixed `Navigation` header
 * (stacked on small screens, row from md+). `env(safe-area-inset-top)` is added on
 * notched devices. No horizontal padding, no nav/positioning changes.
 */
export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="box-border w-full min-w-0 pt-[calc(180px+env(safe-area-inset-top,0px))] md:pt-[calc(140px+env(safe-area-inset-top,0px))]">
      {children}
    </main>
  );
}
