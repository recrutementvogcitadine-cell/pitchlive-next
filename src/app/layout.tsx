import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import LiveBottomNav from "@/components/LiveBottomNav";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PITCH LIVE",
  description: "Application live streaming immersive type TikTok, avec chat, likes, cadeaux et dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${manrope.variable} antialiased`}>
        {children}
        <LiveBottomNav />
      </body>
    </html>
  );
}
