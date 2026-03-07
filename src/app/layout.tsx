import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import InstallAppButton from "@/components/InstallAppButton";
import LiveBottomNav from "@/components/LiveBottomNav";
import PwaBoot from "@/components/PwaBoot";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PITCH LIVE",
  },
  icons: {
    apple: "/icons/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050a16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${manrope.variable} antialiased`}>
        <PwaBoot />
        <InstallAppButton />
        {children}
        <LiveBottomNav />
      </body>
    </html>
  );
}
