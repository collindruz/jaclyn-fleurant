export function SiteFooter() {
  return (
    <footer className="px-5 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-charcoal/[0.04] pt-7 font-sans text-[0.58rem] tracking-[0.1em] text-charcoal/28 sm:flex-row sm:items-baseline sm:justify-between sm:pt-8">
        <a
          href="https://www.instagram.com/jacfleurant/"
          className="w-fit transition-opacity duration-1000 hover:opacity-50"
          target="_blank"
          rel="noreferrer"
        >
          @jacfleurant
        </a>
        <a
          href="mailto:jaclyn.fleurant@gmail.com"
          className="w-fit transition-opacity duration-1000 hover:opacity-50"
        >
          mail
        </a>
      </div>
    </footer>
  );
}
