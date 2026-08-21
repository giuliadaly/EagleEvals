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
  description: "Search Boston College course and professor evaluations, compare the details that matter, and share fully anonymous reviews.",
  applicationName: "EagleEvals",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "EagleEvals",
    title: "EagleEvals · Choose classes with the full picture",
    description: "Course and professor evaluations from Boston College students past and present.",
    url: "/",
    images: [{ url: "/eagleevals-logo-card.png", width: 1200, height: 630, type: "image/png", alt: "EagleEvals circular maroon E logo and wordmark on a warm ivory background" }],
  },
  twitter: { card: "summary_large_image", title: "EagleEvals", description: "Choose classes with the full picture.", images: [{ url: "/eagleevals-logo-card.png", alt: "EagleEvals circular maroon E logo and wordmark" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${archivo.variable} ${atkinson.variable} ${plexMono.variable}`} data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
