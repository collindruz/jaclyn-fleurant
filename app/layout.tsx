import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import { EditorialGrain } from "@/components/EditorialGrain";
import ArtCursor from "@/components/ArtCursor";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500"],
});

const siteUrl = "https://jaclynfleurant.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "JACLYN FLEURANT",
    template: "%s · JACLYN FLEURANT",
  },
  description: "Stylist and creative director — styling, on-set, and live moments.",
  openGraph: {
    title: "JACLYN FLEURANT",
    description: "Stylist and creative director — styling, on-set, and live moments.",
    url: siteUrl,
    siteName: "JACLYN FLEURANT",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JACLYN FLEURANT",
    description: "Stylist and creative director — styling, on-set, and live moments.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <ArtCursor />
        <EditorialGrain />
        <Navigation />
        {children}
      </body>
    </html>
  );
}
