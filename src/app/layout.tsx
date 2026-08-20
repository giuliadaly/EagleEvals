import type { Metadata } from "next";
import "./globals.css";

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
    images: [{ url: "/opengraph-image.png", width: 1730, height: 909, alt: "Abstract course evaluation cards in EagleEvals navy and gold" }],
  },
  twitter: { card: "summary_large_image", title: "EagleEvals", description: "Choose classes with the full picture.", images: ["/opengraph-image.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full scroll-smooth" data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
