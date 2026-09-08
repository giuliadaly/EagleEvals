import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DM_Sans, Patrick_Hand } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
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
  openGraph: {
    type: "website",
    siteName: "EagleEvals",
    title: "EagleEvals · A little advice before you register",
    description: "Course and professor evaluations from Boston College students past and present.",
    url: "/",
    images: [{ url: "/eagleevals-logo-card.png", width: 1200, height: 630, type: "image/png", alt: "EagleEvals gold wing mark and wordmark on maroon" }],
  },
  twitter: { card: "summary_large_image", title: "EagleEvals", description: "A little advice before you register.", images: [{ url: "/eagleevals-logo-card.png", alt: "EagleEvals gold wing mark and wordmark on maroon" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${dmSans.variable} ${patrickHand.variable}`} data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
