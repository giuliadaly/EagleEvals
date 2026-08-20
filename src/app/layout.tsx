import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://eagleevals.com"),
  title: {
    default: "EagleEvals · Boston College Course & Professor Evaluations",
    template: "%s · EagleEvals",
  },
  description: "Search restored Boston College course and professor evaluations, read the complete public archive, and share fully anonymous reviews.",
  applicationName: "EagleEvals",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "EagleEvals",
    title: "EagleEvals · Choose classes with the full picture",
    description: "Recovered course and professor evaluations plus new anonymous student reviews.",
    url: "/",
    images: [{ url: "/opengraph-image.png", width: 1730, height: 909, alt: "EagleEvals course evaluation records in Boston College maroon and gold" }],
  },
  twitter: { card: "summary_large_image", title: "EagleEvals", description: "Choose classes with the full picture.", images: ["/opengraph-image.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${archivo.variable} ${atkinson.variable} ${plexMono.variable}`} data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
