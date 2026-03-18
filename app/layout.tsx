import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Nunito, Fira_Code } from "next/font/google";

import "./globals.css";

const displayFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"]
});

const bodyFont = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"]
});

const monoFont = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
});


export const metadata: Metadata = {
  title: "J7Supreme",
  description: "Building the future of creative tools."
};


export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>

  );
}
