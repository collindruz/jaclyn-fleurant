import Image from "next/image";

/** Public path: reserved for Info; excluded from Work / World / homepage pool via curation. */
export const INFO_PAGE_STILL_SRC =
  "/images/work/site-pull/site-040.jpg" as const;

/**
 * Single floating still: same 4:5 frame and width scale as the homepage
 * (HomeExhibit), not a hero or grid cell.
 */
export function InfoPageStill() {
  return (
    <div
      className="pointer-events-none relative z-0 shrink-0 opacity-[0.93]"
      aria-hidden
    >
      <div
        className="relative w-[min(8.5rem,78vw)] shrink-0 overflow-hidden bg-transparent sm:w-[8.5rem] md:w-[10rem] lg:w-[11rem] xl:w-[12rem] xl:max-w-[12rem]"
        style={{ aspectRatio: "4 / 5" }}
      >
        <div className="absolute inset-0">
          <Image
            src={INFO_PAGE_STILL_SRC}
            alt=""
            fill
            className="object-contain object-center"
            sizes="(max-width: 640px) 50vw, 200px"
            draggable={false}
            priority
          />
        </div>
      </div>
    </div>
  );
}
