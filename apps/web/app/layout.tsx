import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Visibility Radar",
  description: "Measure repeatable brand visibility in ChatGPT, Gemini, and Claude."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
