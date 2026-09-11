import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Zereyakob Elementary School",
    template: "%s · Zereyakob Elementary",
  },
  description:
    "Zereyakob Elementary School Digital Learning Platform — attendance, performance, reports and partnerships, in English and Amharic.",
  keywords: ["Zereyakob", "elementary school", "Ethiopia", "learning platform"],
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}