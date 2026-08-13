import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eagleevals.com"),
  title: {
    default: "EagleEvals",
    template: "%s | EagleEvals",
  },
  description:
    "Explore Boston College course and professor evaluations built for BC students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
